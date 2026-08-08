import Storage from "expo-sqlite/kv-store";

const KEY = "push.deviceId";

/**
 * The in-flight (or settled) lookup, so concurrent callers share one id.
 *
 * `getDeviceId` is a read-modify-write over shared storage, and it *is* called
 * concurrently: `registerPushToken` runs from `usePushRegistration`'s effect,
 * whose in-flight attempt is not cancelled when the effect is torn down — a
 * remount (tab switch, an AuthGate redirect, the iOS permission alert
 * backgrounding and foregrounding the app mid-attempt) starts a second one
 * while the first is still awaiting the OS prompt. On a first launch both find
 * an empty key and each mint a *different* id, so the device ends up with two
 * `pushTokens` rows carrying the same live FCM handle.
 *
 * That is the state this feature has no other way out of: the row is never
 * pruned server-side, because a live handle always sends successfully (see
 * `DEAD_TOKEN_CODES` in `functions/src/notifications/send.ts`), and sign-out
 * only deletes the id this module currently returns — so the orphan goes on
 * delivering that account's notifications to the device after it signs out.
 *
 * Caching the resolved value for the life of the process is correct rather
 * than merely convenient: the id is fixed for the install.
 */
let inFlight: Promise<string> | null = null;

/**
 * A stable per-install id, used as the `users/{uid}/pushTokens/{deviceId}`
 * document id.
 *
 * Not the FCM token itself: tokens rotate, and keying by the token would leave
 * an orphaned row behind on every rotation, which then collects failed sends
 * until FCM finally reports it dead.
 */
export function getDeviceId(): Promise<string> {
  // A rejected lookup must not be cached — storage failing once (a locked
  // database, a mid-migration read) would otherwise poison every later call
  // for the rest of the process, and registration would never recover.
  inFlight ??= load().catch((error: unknown) => {
    inFlight = null;
    throw error;
  });
  return inFlight;
}

async function load(): Promise<string> {
  const existing = await Storage.getItem(KEY);
  if (existing) return existing;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await Storage.setItem(KEY, id);
  return id;
}

/** Drops the cached lookup so each test starts from empty storage. */
export function __resetDeviceIdForTests(): void {
  inFlight = null;
}
