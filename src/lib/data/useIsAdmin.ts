import { useAccount } from "./useAccount";
import { useUser } from "./useUser";

/**
 * Whether the signed-in user is an admin of their organisation.
 *
 * Read live from `users/{uid}` rather than from the AuthProvider snapshot taken
 * at sign-in — `isAdmin` is deliberately not mirrored into custom claims, so a
 * promotion or demotion would otherwise not reach the UI until the app
 * restarted. While the live read is loading it falls back to the session's
 * value, so the gate never flickers into a more-permissive state.
 *
 * Every admin gate in the app goes through this: the account screen's delete
 * button, the settings entries, and the colleague management screens.
 */
export function useIsAdmin(): boolean {
  const { data: session } = useAccount();
  const { data: viewer, loading } = useUser(session?.id ?? "");
  return loading ? session?.isAdmin === true : viewer?.isAdmin === true;
}
