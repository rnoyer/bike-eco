import {
  getMessaging,
  getToken as getFcmToken,
  onTokenRefresh,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { deleteDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

import { pushTokenDoc } from "@/lib/firestore/collections";
import { writeWithTimeout } from "@/lib/firestore/writeWithTimeout";
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

    await write(await getFcmToken(messagingInstance));

    // A fresh registration supersedes whatever listener is currently active -
    // most often its own predecessor from a prior mount that hasn't been
    // cleaned up yet, but on a shared device it can be a different uid
    // entirely. Either way there must be at most one live listener.
    activeSubscription?.unsubscribe();

    // FCM rotates tokens on reinstall, restore and its own schedule. Without
    // this the row goes stale and every send to it fails until FCM reports the
    // handle dead.
    const rawUnsubscribe = onTokenRefresh(messagingInstance, (token) => {
      // The callback closes over `uid`, but `uid` alone can't tell a live
      // callback from one whose registration has since been torn down or
      // superseded - only the module record can. See `activeSubscription`.
      if (isStaleTokenRefresh(activeSubscription?.uid ?? null, uid)) return;
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
    // The ordering requirement is still honoured: the delete is *issued*
    // before `fbSignOut` revokes the credential the owner-only rule checks, so
    // a buffered delete that flushes later still carries a valid auth context.
    // What the ordering never required is *blocking* on it - this is
    // best-effort cleanup, and the server-side prune of dead FCM handles in
    // `send.ts` is the backstop for a row that never goes.
    //
    // No compensation on timeout, for the same reason: a delete landing late
    // is exactly the outcome we want, not one to undo.
    const ref = pushTokenDoc(uid, await getDeviceId());
    await writeWithTimeout(() => deleteDoc(ref), () => {}, UNREGISTER_TIMEOUT_MS);
  } catch (error) {
    console.error("Push unregistration failed", error);
  }
}
