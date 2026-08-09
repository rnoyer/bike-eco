/**
 * A token-refresh callback in `pushRegistration.ts` closes over the uid it
 * was registered for, but by the time FCM actually fires it that uid may no
 * longer be the live registration - the user signed out (the listener was
 * torn down) or a second user signed in on the same device (a different uid
 * is now live). `activeUid` is the module's current record of "who owns the
 * live listener right now"; `callbackUid` is what the firing callback closed
 * over. They diverge exactly in those stale cases.
 *
 * Pulled out as a pure predicate - no `@react-native-firebase/messaging` or
 * `expo-notifications` import here - so it can be unit-tested without a
 * native-module mocking harness.
 */
export function isStaleTokenRefresh(
  activeUid: string | null,
  callbackUid: string,
): boolean {
  return activeUid !== callbackUid;
}
