/**
 * Web build: there is no FCM token to collect and no OS notification tray to
 * write to, so every entry point is an inert no-op with the same signature.
 */
export type PushPermission = "granted" | "denied" | "undetermined";

export async function getPushPermission(): Promise<PushPermission> {
  return "denied";
}

export async function registerPushToken(_uid: string): Promise<() => void> {
  return () => {};
}

export async function unregisterPushToken(_uid: string): Promise<void> {}
