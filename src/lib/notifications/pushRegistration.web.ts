import type { PushPermission } from "./pushRegistration";

/**
 * Web build: there is no FCM token to collect and no OS notification tray to
 * write to, so every entry point is an inert no-op with the same signature.
 * `PushPermission` is imported (type-only, erased at build time) rather than
 * redeclared so this file can't drift from the native one - see `dialog.web.ts`
 * for the same pattern.
 */
export type { PushPermission };

export async function getPushPermission(): Promise<PushPermission> {
  // "denied" would be dishonest (nothing was denied - there's no OS
  // permission on web to deny) and, worse, would make `SettingsList` render
  // the "Notifications désactivées" row, whose button calls
  // `Linking.openSettings()` - a method react-native-web does not implement
  // and which throws if reached. "unsupported" is a value `SettingsList`'s
  // `denied`-only gate never matches, so the row simply never renders here.
  return "unsupported";
}

export function subscribeToPushPermission(
  _listener: (permission: PushPermission) => void,
): () => void {
  // "unsupported" never changes, so there is nothing to ever publish.
  return () => {};
}

export async function registerPushToken(
  _uid: string,
): Promise<(() => void) | null> {
  // `null` = "nothing was registered", which is the honest answer on web and
  // keeps `usePushRegistration`'s retry logic from believing it holds a token.
  return null;
}

export async function unregisterPushToken(_uid: string): Promise<void> {}
