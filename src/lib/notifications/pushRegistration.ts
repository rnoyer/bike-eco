import {
  getMessaging,
  getToken as getFcmToken,
  onTokenRefresh,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import {
  deleteDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { Platform } from "react-native";

import { pushTokenDoc, pushTokensRef } from "@/lib/firestore/collections";
import {
  WRITE_TIMEOUT_MS,
  writeWithTimeout,
} from "@/lib/firestore/writeWithTimeout";
import { getDeviceId } from "./deviceId";
import { isStaleTokenRefresh } from "./staleRegistration";

/**
 * `"unsupported"` is what the web build (`pushRegistration.web.ts`) reports.
 * Reusing `"denied"` there would be dishonest - nothing was denied, there is
 * no OS permission to deny - and it would make `SettingsList`'s `denied`
 * gate render a "Notifications désactivées" row whose button calls
 * `Linking.openSettings()`, which react-native-web does not implement. A
 * fourth state that native code never produces keeps that gate correct on
 * both platforms without an extra platform check at the call site.
 */
export type PushPermission =
  | "granted"
  | "denied"
  | "undetermined"
  | "unsupported";

/**
 * Android 13+ will not show the runtime prompt until at least one notification
 * channel exists, and `getToken()` needs the permission — so the channel has to
 * be created first, every time, before anything else.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Notifications Bike-eco",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

function toPermission(status: Notifications.PermissionStatus): PushPermission {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

/**
 * Subscribers to the OS permission value, for `usePushPermission`.
 *
 * The OS exposes no change event, and the value is changed from a *different
 * screen* than the one that renders it: `registerPushToken` prompts from the
 * Dashboard, while the "Notifications désactivées" row lives on Settings — a
 * sibling NativeTab mounted at the same time. Without this, Settings sits on
 * the "undetermined" it read at mount and never shows the row for a permission
 * the user denied thirty seconds ago on the tab next door. Same single-source
 * requirement `useRegionFilter` satisfies with a live snapshot; here the
 * publisher has to be hand-rolled because there is nothing to listen to.
 */
const permissionListeners = new Set<(permission: PushPermission) => void>();

export function subscribeToPushPermission(
  listener: (permission: PushPermission) => void,
): () => void {
  permissionListeners.add(listener);
  return () => {
    permissionListeners.delete(listener);
  };
}

/** Every path that learns the OS answer announces it, so all readers agree. */
function publishPermission(permission: PushPermission): PushPermission {
  for (const listener of permissionListeners) listener(permission);
  return permission;
}

export async function getPushPermission(): Promise<PushPermission> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return publishPermission(toPermission(status));
  } catch (error) {
    // Callers fire this and forget it (`void getPushPermission()`), with no
    // `.catch()`, so an uncaught rejection would be an unhandled promise
    // rejection rather than the swallowed, logged failure this whole feature
    // promises. "undetermined" is the safe fallback value: like
    // "unsupported" above, it does not satisfy `SettingsList`'s `denied`
    // gate, so a failed permission check never renders a broken row.
    console.error("Push permission check failed", error);
    // Published like any other answer: `usePushPermission` learns the value
    // only through the publisher, so a silent return would leave the Settings
    // row stuck on "loading" forever after one failed check.
    return publishPermission("undetermined");
  }
}

/**
 * The token-refresh listener currently live for this device, if any, and the
 * uid it belongs to.
 *
 * Exists so `unregisterPushToken` can tear the listener down *before*
 * deleting the Firestore row. Without this, the only teardown path is
 * `usePushRegistration`'s effect cleanup - which runs after React re-renders
 * in response to the auth-state change that `signOut` triggers, i.e. *after*
 * the delete has already happened. A token-refresh event landing in that
 * window would call `write()` and recreate the row under the uid that was
 * just signed out, defeating the delete-before-signout ordering in
 * `AuthProvider.signOut`.
 *
 * Also lets a late callback recognize it's stale (see `isStaleTokenRefresh`)
 * and lets a fresh `registerPushToken` call replace an old listener instead
 * of leaking it - e.g. a second user signing in on the same device.
 */
let activeSubscription: { uid: string; unsubscribe: () => void } | null =
  null;

/**
 * Attempt counter, so a *later-resolving older* attempt cannot supersede a
 * newer one's listener.
 *
 * Two `registerPushToken` calls genuinely overlap: `usePushRegistration`'s
 * `attempting` flag is a per-effect closure variable, so it does not span a
 * remount, and an in-flight attempt is not cancelled when its effect is torn
 * down (see the `getDeviceId` comment for the same window). If attempt #2 wins
 * the race and installs its listener, attempt #1 arriving afterwards would call
 * `activeSubscription.unsubscribe()` — tearing down the *live* listener — then
 * install its own, which its own cancelled effect immediately tears down again.
 * The device is left with **zero** token-refresh listeners while the hook still
 * holds a non-null unsubscribe and so never retries: the next FCM rotation is
 * silently never persisted and pushes stop until the app restarts.
 *
 * Comparing the epoch captured at the start of an attempt against the latest
 * one makes "supersede" strictly one-directional — only a newer attempt may
 * replace an older listener, never the reverse.
 */
let registrationEpoch = 0;

/**
 * Delete this account's other rows that carry the FCM handle we just wrote.
 *
 * One token is one device, so any row other than `deviceId` holding it is an
 * orphan: the device registered under an id it has since lost. Clearing app
 * data, a reinstall and a restore all do that, and until `getDeviceId` was
 * made single-flight two overlapping first-launch attempts did too.
 *
 * Nothing else collects these. The server-side prune in
 * `functions/src/notifications/send.ts` only deletes rows FCM reports *dead*,
 * and an orphan's handle is alive — every send to it succeeds. `dispatch`
 * groups by token so the device is not notified twice, but the row still
 * exists, and it is not the one `unregisterPushToken` deletes: after sign-out
 * it keeps delivering that account's notifications to this device.
 *
 * Done at registration rather than at sign-out because the token is already in
 * hand here, with no user waiting on a button and no credential about to be
 * revoked. Best-effort: a failure here must not fail the registration that
 * already succeeded, or `usePushRegistration` would treat the attempt as
 * unregistered and retry it on every foreground.
 */
async function pruneOrphanRows(
  uid: string,
  deviceId: string,
  token: string,
): Promise<void> {
  try {
    const snap = await getDocs(
      query(pushTokensRef(uid), where("token", "==", token)),
    );
    await Promise.all(
      snap.docs
        .filter((row) => row.id !== deviceId)
        .map((row) => deleteDoc(row.ref)),
    );
  } catch (error) {
    console.error("Push orphan prune failed", error);
  }
}

/**
 * Ask once (if never asked), then store this device's FCM token under the
 * signed-in user.
 *
 * Returns an unsubscribe for the token-refresh listener, or `null` when no
 * registration happened (permission not granted, or the attempt failed).
 * `usePushRegistration` needs that distinction to know whether a later retry
 * could still produce anything — a no-op unsubscribe is indistinguishable from
 * a real one. Every failure is swallowed: notifications are an enhancement,
 * and a denied permission or an offline token write must never surface on a
 * working screen.
 */
export async function registerPushToken(
  uid: string,
): Promise<(() => void) | null> {
  const epoch = ++registrationEpoch;
  try {
    await ensureChannel();

    const existing = await Notifications.getPermissionsAsync();
    const status =
      existing.status === "undetermined"
        ? (await Notifications.requestPermissionsAsync()).status
        : existing.status;
    // Announce what the prompt returned: the Settings tab is already mounted
    // and cannot see this answer any other way.
    if (publishPermission(toPermission(status)) !== "granted") return null;

    const deviceId = await getDeviceId();
    const platform = Platform.OS === "ios" ? "ios" : "android";
    const messagingInstance = getMessaging();

    const write = (token: string) =>
      setDoc(pushTokenDoc(uid, deviceId), {
        token,
        platform,
        updatedAt: serverTimestamp(),
      });

    const token = await getFcmToken(messagingInstance);

    // Bounded, for the reason `unregisterPushToken` is: offline, Firestore
    // *buffers* a write it cannot reach the server with, so a bare `setDoc`
    // neither resolves nor rejects. An unbounded one here never lets
    // `registerPushToken` settle, which leaves `usePushRegistration`'s
    // `attempting` flag stuck true — blocking every foreground retry — and
    // means `onTokenRefresh` is never installed for the whole offline window.
    //
    // A *timeout* is not treated as a failed registration, though. The write
    // stays buffered and lands on reconnect, so aborting here would skip the
    // token-refresh listener for a device that ends up registered after all —
    // and the hook only retries on a background→foreground transition, which a
    // phone left in the foreground through the outage never produces. If the
    // process dies before the buffer flushes, the next launch re-registers
    // from scratch anyway. Any *other* rejection (a denied write) is real:
    // rethrow it so the attempt is reported as failed.
    let acknowledged = true;
    try {
      await writeWithTimeout(() => write(token), () => {}, WRITE_TIMEOUT_MS);
    } catch (error) {
      if ((error as { code?: string } | null)?.code !== "unavailable") throw error;
      acknowledged = false;
      console.warn("Push token write not acknowledged yet; still buffered");
    }
    // Only meaningful once the write is on the server: it queries for rows
    // carrying this token, and would not see an unacknowledged one.
    if (acknowledged) await pruneOrphanRows(uid, deviceId, token);

    // A newer attempt started while this one was in flight, and it owns the
    // listener. Never tear down what it installed — that one-directional rule
    // is the whole point of `registrationEpoch`. But if nothing is installed
    // (the newer attempt failed, or has not got there yet) then installing is
    // still better than leaving the device with no listener at all: a newer
    // attempt that later succeeds will simply replace this one.
    const superseded = epoch !== registrationEpoch;
    if (superseded && activeSubscription) return null;

    // A fresh registration supersedes whatever listener is currently active -
    // most often its own predecessor from a prior mount that hasn't been
    // cleaned up yet, but on a shared device it can be a different uid
    // entirely. Either way there must be at most one live listener.
    if (!superseded) activeSubscription?.unsubscribe();

    // FCM rotates tokens on reinstall, restore and its own schedule. Without
    // this the row goes stale and every send to it fails until FCM reports the
    // handle dead.
    const rawUnsubscribe = onTokenRefresh(messagingInstance, (token) => {
      // The callback closes over `uid`, but `uid` alone can't tell a live
      // callback from one whose registration has since been torn down or
      // superseded - only the module record can. See `activeSubscription`.
      if (isStaleTokenRefresh(activeSubscription?.uid ?? null, uid)) return;
      // Deliberately *not* bounded, unlike the registration write above: no
      // one awaits this and nothing is blocked on it, so letting Firestore
      // buffer it and flush on reconnect persists the rotated token, where a
      // timeout would discard it until the next registration.
      void write(token).catch(console.error);
    });

    let unsubscribed = false;
    const unsubscribe = () => {
      // Idempotent: both `unregisterPushToken` and the effect cleanup in
      // `usePushRegistration` may call this same function, and the native
      // listener's own tolerance for a repeat call is not something to rely
      // on.
      if (unsubscribed) return;
      unsubscribed = true;
      rawUnsubscribe();
      // Only clear the module record if it's still this registration's -
      // a newer `registerPushToken` call (or `unregisterPushToken`) may have
      // already replaced or cleared it, and this stale cleanup must not
      // clobber that.
      if (activeSubscription?.unsubscribe === unsubscribe) {
        activeSubscription = null;
      }
    };
    activeSubscription = { uid, unsubscribe };
    return unsubscribe;
  } catch (error) {
    console.error("Push registration failed", error);
    return null;
  }
}

/**
 * How long the sign-out path waits for the token delete before giving up on
 * it. Much shorter than `WRITE_TIMEOUT_MS`: nothing depends on the result, and
 * this sits directly under a button the user is waiting on.
 */
const UNREGISTER_TIMEOUT_MS = 3000;

/** Drop this device's row so a signed-out account stops receiving pushes. */
export async function unregisterPushToken(uid: string): Promise<void> {
  try {
    // Tear down the token-refresh listener before the delete, not after -
    // see the `activeSubscription` comment above for why the usual
    // effect-cleanup teardown is too late to close this window.
    if (activeSubscription?.uid === uid) activeSubscription.unsubscribe();
    // Bounded, because `signOut` awaits this: offline, Firestore *buffers* a
    // write it cannot reach the server with, so a bare `deleteDoc` neither
    // resolves nor rejects (see `writeWithTimeout`) and the "Se déconnecter"
    // button - wrapped in `useAsyncAction` - would spin forever with no error
    // and no escape.
    //
    // Issuing the delete before `fbSignOut` is what buys the owner-only rule a
    // valid credential, but only for a delete that reaches the server *within*
    // the bound. A timed-out one does not land later: Firestore attaches
    // credentials when a mutation is sent, not when it is queued, and it
    // abandons the previous user's unacknowledged mutations on the user change
    // `fbSignOut` triggers. So the timeout branch loses the delete outright.
    //
    // Accepted rather than papered over with a longer bound, which would only
    // move the cliff while making the button slower. The recovery is on the
    // next sign-in: `pruneOrphanRows` deletes every row of this account that
    // carries the handle, including one this path failed to remove.
    //
    // Hence no compensation either - there is nothing to undo, and a delete
    // that does land late is the outcome we wanted.
    // `getDeviceId` is inside the bound, not before it: it is a read-modify-
    // write over kv storage whose promise is cached and shared, so a wedged
    // native side (a locked database, a mid-migration read) would hang here
    // just as surely as a buffered delete — and with the same consequence,
    // since `signOut` awaits this before `fbSignOut`. Bounding only the delete
    // left the slower half of the work unbounded under a button the user is
    // waiting on.
    await writeWithTimeout(
      async () => {
        const ref = pushTokenDoc(uid, await getDeviceId());
        await deleteDoc(ref);
      },
      () => {},
      UNREGISTER_TIMEOUT_MS,
    );
  } catch (error) {
    console.error("Push unregistration failed", error);
  }
}
