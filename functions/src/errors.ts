/** Error codes that map 1:1 onto Firebase `HttpsError` codes (see `toHttps`). */
export type RegErrorCode =
  | "unauthenticated" | "permission-denied" | "already-exists"
  | "invalid-argument" | "not-found" | "failed-precondition";

/** A failure with French, user-facing copy. `toHttps` turns it into an HttpsError. */
export class RegError extends Error {
  constructor(public code: RegErrorCode, message: string) {
    super(message);
  }
}

/** The caller's identity, read from the verified ID token's custom claims. */
export interface CallerClaims {
  uid: string;
  role?: string;
  status?: string;
  companyId?: string | null;
}
