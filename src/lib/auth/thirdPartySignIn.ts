import { deleteUser, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";

import { auth } from "../../../firebaseConfig";
import { mapDataError } from "../data/dataErrors";
import { userDoc } from "../firestore/collections";
import { WRITE_TIMEOUT_MS, writeWithTimeout } from "../firestore/writeWithTimeout";
import type { ProviderSignInOptions, ProviderSignInResult } from "./appleSignInContract";
import { signInWithApple } from "./appleSignIn";
import { signInWithGoogle } from "./googleSignIn";
import { PROVIDER_LABELS, type AuthProviderId } from "./providerEmail";

const SIGN_IN: Record<
  AuthProviderId,
  (opts?: ProviderSignInOptions) => Promise<ProviderSignInResult>
> = {
  google: signInWithGoogle,
  apple: signInWithApple,
};

/**
 * Sign in an *existing* account with a third-party provider.
 *
 * Sign-in is not registration: a provider identity with no `users/{uid}`
 * document has never been through a funnel, and would otherwise sit
 * authenticated-but-sessionless on the sign-in screen (see `AuthProvider`). It
 * is refused — and the Auth record this very call created is deleted rather
 * than left behind with no profile, no claims and no password. A record that
 * already existed is only signed out; it may belong to someone mid-registration.
 *
 * Throws an already-French `Error` with no `code`, so `frenchAuthMessage` passes
 * the message through untouched. Resolves only when a session may stand — the
 * root AuthGate then redirects on the auth-state change.
 */
export async function signInExistingAccount(
  provider: AuthProviderId,
): Promise<void> {
  const { isNewUser } = await SIGN_IN[provider]();
  const user = auth.currentUser;
  if (!user) throw new Error("La connexion a échoué. Veuillez réessayer.");

  let registered: boolean;
  try {
    // Firestore buffers a read it cannot reach the server with instead of
    // rejecting, which would leave the button disabled with no feedback, so the
    // read is raced against the shared fail-fast timeout.
    registered = (
      await writeWithTimeout(
        () => getDoc(userDoc(user.uid)),
        () => {},
        WRITE_TIMEOUT_MS,
      )
    ).exists();
  } catch (e) {
    // Firestore codes (`unavailable`, `permission-denied`) are not auth codes:
    // `frenchAuthMessage` would fall through to the SDK's English message, so
    // they are mapped here through the data-error counterpart.
    await signOut(auth);
    throw new Error(mapDataError((e as { code?: string }).code ?? ""));
  }

  if (!registered) {
    if (isNewUser) await deleteUser(user).catch(() => signOut(auth));
    else await signOut(auth);
    throw new Error(
      `Aucun compte Bike-eco n’est associé à ce compte ${PROVIDER_LABELS[provider]}. Créez un compte pour continuer.`,
    );
  }
}
