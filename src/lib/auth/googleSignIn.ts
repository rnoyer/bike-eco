import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import {
  getAdditionalUserInfo,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import { emailsMatch, GoogleEmailMismatchError } from "./googleEmail";

// webClientId comes from the Firebase console (owner setup); read from env so it
// is not hardcoded. iosClientId is only needed on iOS.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export async function signInWithGoogle(opts?: {
  /** Invited registration: the account picked must be the invitation's address. */
  expectedEmail?: string;
}): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
  /** True when this sign-in created the Firebase Auth record, so a caller that
   *  rejects the identity can delete it instead of leaving a dormant account. */
  isNewUser: boolean;
}> {
  await GoogleSignin.hasPlayServices();
  // On Android the native module can silently reuse the last selected Google
  // account. Explicitly sign out of the Google SDK first so the user gets the
  // account chooser each time instead of the cached account.
  await GoogleSignin.signOut();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new Error("Connexion Google annulée.");
  const { idToken, user } = response.data;
  // Compare before signInWithCredential: Google has told us the address but
  // Firebase has not seen the credential yet, so a mismatched account is never
  // created. Creating it first would strand an Auth user with no profile, no
  // claims and no password — unreachable and impossible to clean up client-side.
  if (opts?.expectedEmail && !emailsMatch(user.email, opts.expectedEmail)) {
    // Drop the Google session too, so the next attempt re-opens the chooser.
    await GoogleSignin.signOut();
    throw new GoogleEmailMismatchError(user.email, opts.expectedEmail);
  }
  const cred = await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return {
    prenom: user.givenName ?? null,
    nom: user.familyName ?? null,
    email: user.email ?? null,
    isNewUser: getAdditionalUserInfo(cred)?.isNewUser ?? false,
  };
}
