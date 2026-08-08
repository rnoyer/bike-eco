import Storage from "expo-sqlite/kv-store";

const KEY = "push.deviceId";

/**
 * A stable per-install id, used as the `users/{uid}/pushTokens/{deviceId}`
 * document id.
 *
 * Not the FCM token itself: tokens rotate, and keying by the token would leave
 * an orphaned row behind on every rotation, which then collects failed sends
 * until FCM finally reports it dead.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await Storage.getItem(KEY);
  if (existing) return existing;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await Storage.setItem(KEY, id);
  return id;
}
