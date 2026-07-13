import type { AppUser, Region, UserRole, UserStatus } from "@/lib/firestore/schema";
import type { WithId } from "@/lib/firestore/collections";

export interface AuthClaims {
  role: UserRole;
  companyId: string | null;
  region: Region | null;
  status: UserStatus;
}

export type SessionUser = WithId<AppUser>;

/**
 * Assemble the session identity. Custom claims are the source of truth for the
 * privileged fields (role/companyId/region/status); the `users` doc supplies the
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
    region: claims.region,
    status: claims.status,
  };
}

/** Narrow a raw Firebase ID-token claims bag to our typed shape. */
export function parseClaims(raw: Record<string, unknown>): AuthClaims {
  return {
    role: (raw.role as UserRole) ?? "b2b",
    companyId: (raw.companyId as string | null) ?? null,
    region: (raw.region as Region | null) ?? null,
    status: (raw.status as UserStatus) ?? "pending",
  };
}
