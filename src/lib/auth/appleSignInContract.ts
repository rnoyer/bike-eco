/**
 * The contract the three `appleSignIn.*` platform variants share.
 *
 * Metro picks exactly one of `appleSignIn.ios.ts`, `.web.ts` or `.ts` at build
 * time, and `tsc` checks each in isolation — nothing cross-checks them against
 * each other, and a consumer importing `@/lib/auth/appleSignIn` type-resolves to
 * the plain (Android) variant. Referencing these aliases from all three makes a
 * drift in the option or result SHAPE a compile error.
 *
 * The residual gap this does NOT close: a variant that omits an export
 * altogether still compiles. That case is covered by the filename/export check
 * in the task's verification step, and would fail loudly at import time.
 */
export interface ProviderSignInOptions {
  /** Invited registration: the account used must be the invitation's address. */
  expectedEmail?: string;
}

export interface ProviderSignInResult {
  prenom: string | null;
  nom: string | null;
  email: string | null;
  /** True when this sign-in created the Firebase Auth record, so a caller that
   *  rejects the identity can delete it instead of leaving a dormant account. */
  isNewUser: boolean;
}
