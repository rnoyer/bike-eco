import type { PushPermission } from "./pushRegistration";

/**
 * Web build: there is no FCM token to collect and no OS notification tray to
 * write to, so every entry point is an inert no-op with the same signature.
 * `PushPermission` is imported (type-only, erased at build time) rather than
 * redeclared so this file can't drift from the native one - see `dialog.web.ts`
 * for the same pattern.
 */
export type { PushPermission };

// Mirrors the native module's `permissionListeners` / `publishPermission`
// pair (`pushRegistration.ts`). `usePushPermission` never reads
// `getPushPermission`'s return value directly - it learns the answer only
// through this publisher (subscribe, then the mount-time `getPushPermission()`
// call delivers the first announcement). Without a web-side publisher too,
// the subscription is permanently inert and the hook sits on "loading"
// forever, even though the true answer ("unsupported") is known immediately.
const permissionListeners = new Set<(permission: PushPermission) => void>();

export async function getPushPermission(): Promise<PushPermission> {
  // "denied" would be dishonest (nothing was denied - there's no OS
  // permission on web to deny) and, worse, would make `SettingsList` render
  // the "Notifications désactivées" row, whose button calls
  // `Linking.openSettings()` - a method react-native-web does not implement
  // and which throws if reached. "unsupported" is a value `SettingsList`'s
  // `denied`-only gate never matches, so the row simply never renders here.
  for (const listener of permissionListeners) listener("unsupported");
  return "unsupported";
}

export function subscribeToPushPermission(
  listener: (permission: PushPermission) => void,
): () => void {
  // "unsupported" never changes once announced, but a listener that
  // subscribes needs that first announcement to arrive - it comes from the
  // next `getPushPermission()` call (the hook makes one right after
  // subscribing), not from this call itself, matching the native module's
  // subscribe-then-read ordering exactly.
  permissionListeners.add(listener);
  return () => {
    permissionListeners.delete(listener);
  };
}

export async function registerPushToken(
  _uid: string,
): Promise<(() => void) | null> {
  // `null` = "nothing was registered", which is the honest answer on web and
  // keeps `usePushRegistration`'s retry logic from believing it holds a token.
  return null;
}

export async function unregisterPushToken(_uid: string): Promise<void> {}
