import type { AppUser, UserRole, UserStatus } from "@/lib/firestore/schema";
import type { WithId } from "@/lib/firestore/collections";

export interface AuthClaims {
  role: UserRole;
  companyId: string | null;
  status: UserStatus;
}

export type SessionUser = WithId<AppUser>;

/**
 * Assemble the session identity. Custom claims are the source of truth for the
 * privileged fields (role/companyId/status); the `users` doc supplies the
 * editable profile. Claims win so a stale profile can't grant the wrong access.
 */
export function buildSessionUser(
  uid: string,
  claims: AuthClaims,
  profile: AppUser,
): SessionUser {
  return {
    ...profile,
    id: uid,
    role: claims.role,
    companyId: claims.companyId,
    status: claims.status,
  };
}

/**
 * Whether a live `users/{uid}` snapshot means this signed-in account was
 * deleted out from under the session.
 *
 * Deleting an Auth user server-side does **not** invalidate the ID token the
 * device already holds — it stays valid until it expires (up to an hour), and
 * every rule in `firestore.rules` authorizes on that token's claims alone,
 * never on the profile doc existing. So the profile vanishing is the only
 * prompt signal the client gets that the account is gone.
 *
 * `fromCache` is the guard against a false positive: offline, "no such
 * document" means "not in this device's cache", not "deleted on the server",
 * and signing a legitimate user out for being offline would be a worse bug
 * than the one this closes.
 */
export function isAccountDeleted(snapshot: {
  exists: boolean;
  fromCache: boolean;
}): boolean {
  return !snapshot.exists && !snapshot.fromCache;
}

/** Narrow a raw Firebase ID-token claims bag to our typed shape. */
export function parseClaims(raw: Record<string, unknown>): AuthClaims {
  return {
    role: (raw.role as UserRole) ?? "b2b",
    companyId: (raw.companyId as string | null) ?? null,
    status: (raw.status as UserStatus) ?? "pending",
  };
}
