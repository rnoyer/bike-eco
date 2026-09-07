/**
 * Email matching for the third-party sign-in paths, shared by every provider
 * and by both platform variants of each (hence no platform suffix — and
 * unit-testable without any native module).
 *
 * The invited-registration funnel locks the email to the invitation's address:
 * the provider account the user picks must be that same address. Mirrors the
 * server-side rule in `acceptInviteCore`, which stays as defence in depth.
 */

/** The third-party providers the app can sign in with. */
export type AuthProviderId = "google" | "apple";

/** How each provider is named in user-facing French copy. */
export const PROVIDER_LABELS: Record<AuthProviderId, string> = {
  google: "Google",
  apple: "Apple",
};

/** Case- and whitespace-insensitive comparison; nullish never matches. */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Names both addresses so the user knows which account to pick on retry. */
export function providerEmailMismatchMessage(
  provider: AuthProviderId,
  providerEmail: string | null | undefined,
  expectedEmail: string,
): string {
  const label = PROVIDER_LABELS[provider];
  const picked = providerEmail?.trim()
    ? `Le compte ${label} ${providerEmail.trim()}`
    : `Le compte ${label} sélectionné`;
  return `${picked} ne correspond pas à l'invitation envoyée à ${expectedEmail}. Reprenez avec le bon compte ${label}.`;
}

/** Thrown before the credential reaches Firebase Auth where the provider tells
 *  us the address up front, and to undo the sign-in where it does not. */
export class ProviderEmailMismatchError extends Error {
  readonly provider: AuthProviderId;
  readonly providerEmail: string | null;
  readonly expectedEmail: string;

  constructor(
    provider: AuthProviderId,
    providerEmail: string | null | undefined,
    expectedEmail: string,
  ) {
    super(providerEmailMismatchMessage(provider, providerEmail, expectedEmail));
    this.name = "ProviderEmailMismatchError";
    this.provider = provider;
    this.providerEmail = providerEmail ?? null;
    this.expectedEmail = expectedEmail;
  }
}
