/**
 * Email matching for the Google sign-in paths, shared by the native and web
 * variants of `signInWithGoogle` (hence no platform suffix — and unit-testable
 * without the native module).
 *
 * The invited-registration funnel locks the email to the invitation's address:
 * the Google account the user picks must be that same address. Mirrors the
 * server-side rule in `acceptInviteCore`, which stays as defence in depth.
 */

/** Case- and whitespace-insensitive comparison; nullish never matches. */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Names both addresses so the user knows which account to pick on retry. */
export function googleEmailMismatchMessage(
  googleEmail: string | null | undefined,
  expectedEmail: string,
): string {
  const picked = googleEmail?.trim()
    ? `Le compte Google ${googleEmail.trim()}`
    : "Le compte Google sélectionné";
  return `${picked} ne correspond pas à l'invitation envoyée à ${expectedEmail}. Reprenez avec le bon compte Google.`;
}

/** Thrown before the credential reaches Firebase Auth, so the mismatched
 *  account is never created (native) or is undone (web). */
export class GoogleEmailMismatchError extends Error {
  readonly googleEmail: string | null;
  readonly expectedEmail: string;

  constructor(googleEmail: string | null | undefined, expectedEmail: string) {
    super(googleEmailMismatchMessage(googleEmail, expectedEmail));
    this.name = "GoogleEmailMismatchError";
    this.googleEmail = googleEmail ?? null;
    this.expectedEmail = expectedEmail;
  }
}
