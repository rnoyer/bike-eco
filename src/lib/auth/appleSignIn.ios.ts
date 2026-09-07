import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  deleteUser,
  getAdditionalUserInfo,
  OAuthProvider,
  signInWithCredential,
  signOut,
} from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import { appleIdTokenEmail } from "./appleIdToken";
import type {
  ProviderSignInOptions,
  ProviderSignInResult,
} from "./providerSignInContract";
import { emailsMatch, ProviderEmailMismatchError } from "./providerEmail";

/** iOS 13+ on a device signed in to iCloud with 2FA. False everywhere else. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

/**
 * The nonce, in both the forms this flow needs.
 *
 * Getting the two backwards is *the* Sign in with Apple bug, and it surfaces as
 * `auth/missing-or-invalid-nonce`: Apple receives the SHA-256 **digest**, and
 * Firebase receives the **raw** string, so that Firebase can hash it itself and
 * confirm the token it was handed answers this specific request.
 * `digestStringAsync` returns hex by default, which is the encoding Apple wants.
 */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Array.from(Crypto.getRandomBytes(32), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
  );
  return { raw, hashed };
}

export async function signInWithApple(
  opts?: ProviderSignInOptions,
): Promise<ProviderSignInResult> {
  const { raw, hashed } = await makeNonce();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed, // Apple gets the digest.
    });
  } catch (e) {
    // Apple's cancellation carries `code: "ERR_REQUEST_CANCELED"` — a code that
    // is not an `auth/*` code, so `frenchAuthMessage` would fall through to the
    // generic "la connexion a échoué" for what is just a tap on Annuler.
    // Rethrow as a bare French Error with no `code`, which is the contract
    // `authErrors.ts` documents and `googleSignIn.ts` also honours.
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      throw new Error("Connexion Apple annulée.");
    }
    throw e;
  }

  const { identityToken, fullName } = credential;
  if (!identityToken) {
    throw new Error("La connexion Apple a échoué. Veuillez réessayer.");
  }

  // Apple hands over the email only on the *first* authorization for this Apple
  // ID; later sign-ins return null and we fall back to the token's claim, which
  // is usually but not always present.
  const knownEmail = credential.email ?? appleIdTokenEmail(identityToken);

  // Tier 1 — the address is known before Firebase has seen anything, so a
  // mismatched account is never created. Creating it first would strand an Auth
  // user with no profile, no claims and no password: unreachable, and
  // impossible to clean up client-side.
  if (
    opts?.expectedEmail &&
    knownEmail &&
    !emailsMatch(knownEmail, opts.expectedEmail)
  ) {
    throw new ProviderEmailMismatchError("apple", knownEmail, opts.expectedEmail);
  }

  const cred = await signInWithCredential(
    auth,
    new OAuthProvider("apple.com").credential({
      idToken: identityToken,
      rawNonce: raw, // Firebase gets the raw string.
    }),
  );
  const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
  const email = knownEmail ?? cred.user.email;

  // Tier 2 — a repeat authorization that told us nothing. Firebase persisted the
  // address on the account at first sign-in, so compare that and undo, the same
  // way `googleSignIn.web.ts` undoes a popup it could not pre-empt. Only an
  // account this call just created may be deleted; a pre-existing one belongs to
  // a real user and is merely signed back out. A null address fails the match
  // and is refused too — an unverifiable identity must not pass.
  if (opts?.expectedEmail && !emailsMatch(email, opts.expectedEmail)) {
    if (isNewUser) await deleteUser(cred.user).catch(() => signOut(auth));
    else await signOut(auth);
    throw new ProviderEmailMismatchError("apple", email, opts.expectedEmail);
  }

  return {
    // Also first-authorization-only. An empty prefill just means the user types
    // their name on the "Vos coordonnées" step, as in the password flow.
    prenom: fullName?.givenName ?? null,
    nom: fullName?.familyName ?? null,
    email: email ?? null,
    isNewUser,
  };
}
