import {
  getMessaging,
  getToken as getFcmToken,
  onTokenRefresh,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { deleteDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

import { pushTokenDoc } from "@/lib/firestore/collections";
import { getDeviceId } from "./deviceId";

export type PushPermission = "granted" | "denied" | "undetermined";

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

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return toPermission(status);
}

/**
 * Ask once (if never asked), then store this device's FCM token under the
 * signed-in user.
 *
 * Returns an unsubscribe for the token-refresh listener. Every failure is
 * swallowed: notifications are an enhancement, and a denied permission or an
 * offline token write must never surface on a working screen.
 */
export async function registerPushToken(uid: string): Promise<() => void> {
  try {
    await ensureChannel();

    const existing = await Notifications.getPermissionsAsync();
    const status =
      existing.status === "undetermined"
        ? (await Notifications.requestPermissionsAsync()).status
        : existing.status;
    if (toPermission(status) !== "granted") return () => {};

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
    // FCM rotates tokens on reinstall, restore and its own schedule. Without
    // this the row goes stale and every send to it fails until FCM reports the
    // handle dead.
    return onTokenRefresh(messagingInstance, (token) => {
      void write(token).catch(console.error);
    });
  } catch (error) {
    console.error("Push registration failed", error);
    return () => {};
  }
}

/** Drop this device's row so a signed-out account stops receiving pushes. */
export async function unregisterPushToken(uid: string): Promise<void> {
  try {
    await deleteDoc(pushTokenDoc(uid, await getDeviceId()));
  } catch (error) {
    console.error("Push unregistration failed", error);
  }
}
