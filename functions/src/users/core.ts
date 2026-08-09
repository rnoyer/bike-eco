import { RegError, type CallerClaims } from "../errors";
import type { ColleagueActionInput, ColleagueAdminInput } from "./schemas";

/** The set of users a caller may act on: their company, or the back-office team. */
export type Scope =
  | { kind: "company"; companyId: string }
  | { kind: "backoffice" };

/** The subset of a `users/{uid}` document these operations need. */
export interface TargetUser {
  uid: string;
  role: string;
  companyId: string | null;
  isAdmin: boolean;
}

export interface UsersDeps {
  getUser(uid: string): Promise<TargetUser | null>;
  /** How many admins the scope currently has. */
  countAdmins(scope: Scope): Promise<number>;
  setAdmin(uid: string, isAdmin: boolean): Promise<void>;
  /** Tolerates an already-missing Auth user. */
  deleteAuthUser(uid: string): Promise<void>;
  deleteUserDoc(uid: string): Promise<void>;
}

/**
 * Scope comes from the verified custom claims (role/companyId), which are the
 * source of truth for access; only `isAdmin` is read from the profile document,
 * because it is deliberately not mirrored into claims (a claim would stay stale
 * until the promoted user's ID token refreshed).
 */
function scopeOf(caller: CallerClaims): Scope {
  if (caller.role === "backoffice") return { kind: "backoffice" };
  if (caller.role === "b2b" && caller.companyId) {
    return { kind: "company", companyId: caller.companyId };
  }
  throw new RegError("permission-denied", "Action non autorisée.");
}

function inScope(target: TargetUser, scope: Scope): boolean {
  return scope.kind === "backoffice"
    ? target.role === "backoffice"
    : target.role === "b2b" && target.companyId === scope.companyId;
}

function lastAdminMessage(scope: Scope): string {
  return scope.kind === "backoffice"
    ? "L'équipe Bike-eco doit garder au moins un administrateur."
    : "Cette entreprise doit garder au moins un administrateur.";
}

async function requireAdminCaller(caller: CallerClaims, deps: UsersDeps): Promise<Scope> {
  if (caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée aux comptes actifs.");
  }
  const scope = scopeOf(caller);
  const me = await deps.getUser(caller.uid);
  if (!me) throw new RegError("not-found", "Compte introuvable.");
  if (!me.isAdmin) {
    throw new RegError("permission-denied", "Action réservée aux administrateurs.");
  }
  return scope;
}

/** The target must exist *and* be in the caller's scope — the two are reported
 *  identically on purpose, so this never confirms that a uid outside the scope
 *  exists. */
async function requireTarget(uid: string, scope: Scope, deps: UsersDeps): Promise<TargetUser> {
  const target = await deps.getUser(uid);
  if (!target || !inScope(target, scope)) {
    throw new RegError("not-found", "Utilisateur introuvable.");
  }
  return target;
}

export async function setColleagueAdminCore(
  input: ColleagueAdminInput,
  caller: CallerClaims,
  deps: UsersDeps,
): Promise<void> {
  const scope = await requireAdminCaller(caller, deps);
  const target = await requireTarget(input.uid, scope, deps);
  if (target.isAdmin === input.isAdmin) return;
  if (!input.isAdmin && (await deps.countAdmins(scope)) <= 1) {
    throw new RegError("failed-precondition", lastAdminMessage(scope));
  }
  await deps.setAdmin(input.uid, input.isAdmin);
}

export async function deleteColleagueCore(
  input: ColleagueActionInput,
  caller: CallerClaims,
  deps: UsersDeps,
): Promise<void> {
  const scope = await requireAdminCaller(caller, deps);
  if (input.uid === caller.uid) {
    throw new RegError(
      "failed-precondition",
      "Utilisez « Supprimer mon compte » pour votre propre compte.",
    );
  }
  const target = await requireTarget(input.uid, scope, deps);
  if (target.isAdmin) {
    throw new RegError("failed-precondition", "Un administrateur ne peut pas être supprimé.");
  }
  // Auth first: a stranded profile doc is visible and fixable, a stranded Auth
  // user is a signed-in session with no profile. Dossiers, messages and Storage
  // are deliberately untouched — they carry denormalized identity.
  await deps.deleteAuthUser(input.uid);
  await deps.deleteUserDoc(input.uid);
}

/**
 * Self-deletion. Unlike the other two this does not require an `active`
 * account: a colleague still waiting on the company's validation must be able
 * to cancel. Admins are refused — an admin account cannot be deleted.
 */
export async function deleteMyAccountCore(
  caller: CallerClaims,
  deps: UsersDeps,
): Promise<void> {
  const me = await deps.getUser(caller.uid);
  if (!me) throw new RegError("not-found", "Compte introuvable.");
  if (me.isAdmin) {
    throw new RegError(
      "failed-precondition",
      "Un administrateur ne peut pas supprimer son compte.",
    );
  }
  await deps.deleteAuthUser(caller.uid);
  await deps.deleteUserDoc(caller.uid);
}
