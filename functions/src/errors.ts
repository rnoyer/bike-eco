/** Error codes that map 1:1 onto Firebase `HttpsError` codes (see `toHttps`). */
type RegErrorCode =
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

/**
 * The guard every back-office-only callable starts with.
 *
 * Role and status collapse into one message on purpose: an inactive
 * back-office account and a b2b account are both simply "not allowed here",
 * and distinguishing them in the copy would tell a caller which half of the
 * check they failed.
 */
export function assertBackoffice(caller: CallerClaims): void {
  if (caller.role !== "backoffice" || caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée à l'équipe Bike-eco.");
  }
}
