/** Shape of the only part of a Firebase `User` this module needs — kept minimal
 *  so the helper stays pure and unit-testable (no `firebaseConfig` import). */
interface WithProviders {
  providerData: { providerId: string }[];
}

/** True when the account actually has a password credential.
 *
 *  A Google-only account has none: sending it a reset link is meaningless, so
 *  the "Changer mon mot de passe" action is hidden for those users. */
export function hasPasswordProvider(user: WithProviders | null): boolean {
  return user?.providerData.some((p) => p.providerId === "password") ?? false;
}
