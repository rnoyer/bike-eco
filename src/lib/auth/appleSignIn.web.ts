import {
  deleteUser,
  getAdditionalUserInfo,
  OAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import type {
  ProviderSignInOptions,
  ProviderSignInResult,
} from "./providerSignInContract";
import { emailsMatch, ProviderEmailMismatchError } from "./providerEmail";

/** The popup flow works in any browser; there is no device capability to probe. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return true;
}

export async function signInWithApple(
  opts?: ProviderSignInOptions,
): Promise<ProviderSignInResult> {
  // No manual nonce here: unlike the native flow, `signInWithPopup` runs the
  // whole OAuth round-trip itself and manages its own nonce.
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  const result = await signInWithPopup(auth, provider);
  const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
  // As with Google on web, the popup has already signed in by the time it
  // returns, so a mismatch has to be undone rather than prevented. Only an
  // account this popup just created may be deleted — a mismatched but
  // pre-existing account belongs to a real user and is merely signed back out.
  if (opts?.expectedEmail && !emailsMatch(result.user.email, opts.expectedEmail)) {
    // The undo is best-effort; the refusal is not. Letting `deleteUser` (or
    // `signOut`) reject would skip the throw below, so the caller would report
    // the generic "la connexion a échoué" *and* leave the refused Apple identity
    // signed in — failing open on identity, the one thing this branch exists to
    // prevent. Falling back to `signOut` mirrors the iOS variant; where that one
    // guards only the delete, this also guards the sign-out, since neither undo
    // is worth a swallowed refusal. `googleSignIn.web.ts` still has the
    // unguarded shape this replaced.
    try {
      if (isNewUser) await deleteUser(result.user);
      else await signOut(auth);
    } catch {
      await signOut(auth).catch(() => {});
    }
    throw new ProviderEmailMismatchError(
      "apple",
      result.user.email,
      opts.expectedEmail,
    );
  }
  // Apple gives web a single displayName, and only on a first sign-in; split
  // best-effort into prénom / nom exactly as the Google web variant does.
  const parts = (result.user.displayName ?? "").trim().split(/\s+/);
  return {
    prenom: parts[0] || null,
    nom: parts.length > 1 ? parts.slice(1).join(" ") : null,
    email: result.user.email ?? null,
    isNewUser,
  };
}
