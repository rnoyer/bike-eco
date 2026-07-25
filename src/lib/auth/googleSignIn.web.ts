import {
  deleteUser,
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import { emailsMatch, GoogleEmailMismatchError } from "./googleEmail";

export async function signInWithGoogle(opts?: {
  /** Invited registration: the account picked must be the invitation's address. */
  expectedEmail?: string;
}): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
}> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  // Unlike native, the popup has already signed in by the time it returns, so a
  // mismatch has to be undone rather than prevented. Only an account this popup
  // just created may be deleted — a mismatched but pre-existing account belongs
  // to a real user and is merely signed back out.
  if (opts?.expectedEmail && !emailsMatch(result.user.email, opts.expectedEmail)) {
    if (getAdditionalUserInfo(result)?.isNewUser) await deleteUser(result.user);
    else await signOut(auth);
    throw new GoogleEmailMismatchError(result.user.email, opts.expectedEmail);
  }
  // Web only gives a single displayName; split best-effort into prénom / nom.
  const parts = (result.user.displayName ?? "").trim().split(/\s+/);
  return {
    prenom: parts[0] || null,
    nom: parts.length > 1 ? parts.slice(1).join(" ") : null,
    email: result.user.email ?? null,
  };
}
