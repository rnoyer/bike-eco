import { RegError, type CallerClaims } from "../errors";
import type {
  ColleagueActionInput,
  ColleagueAdminInput,
  UpdateMyProfileInput,
} from "./schemas";

/** The set of users a caller may act on: their company, or the back-office team. */
export type Scope =
  | { kind: "company"; companyId: string }
  | { kind: "backoffice" };

/**
 * The subset of a `users/{uid}` document these operations need.
 *
 * The three profile fields are here rather than behind a second dep because
 * `getUser` already reads the whole document: `updateMyProfileCore` compares
 * the incoming values against them to decide what actually changed, and a
 * separate `getProfile` would be the same read twice.
 */
export interface TargetUser {
  uid: string;
  role: string;
  companyId: string | null;
  isAdmin: boolean;
  nom: string;
  prenom: string;
  telephone: string;
}

/** The fields a user may edit on their own profile — all optional, all changed
 *  together or one at a time. */
export type ProfilePatch = UpdateMyProfileInput;

/** The profile fields, in the order `createdByName` and the emails read them. */
const PROFILE_FIELDS = ["nom", "prenom", "telephone"] as const;

/** Everyone in a scope, as the membership decisions need them. */
export interface Member {
  uid: string;
  isAdmin: boolean;
}

export interface UsersDeps {
  getUser(uid: string): Promise<TargetUser | null>;
  /**
   * Everyone currently in the scope, the caller included. One read answers both
   * questions self-deletion asks — "am I the last admin?" and "am I the last
   * member?" — and the implementation already fetches the documents to count
   * admins, so this costs nothing extra.
   */
  listMembers(scope: Scope): Promise<Member[]>;
  setAdmin(uid: string, isAdmin: boolean): Promise<void>;
  /** Tolerates an already-missing Auth user. */
  deleteAuthUser(uid: string): Promise<void>;
  deleteUserDoc(uid: string): Promise<void>;
  /** Writes the changed profile fields onto `users/{uid}`. */
  updateProfile(uid: string, patch: ProfilePatch): Promise<void>;
  /**
   * Rewrites `submitter.*` on every dossier this user submitted. Privileged:
   * `firestore.rules` lets nobody write those fields from a client.
   */
  propagateToDossiers(uid: string, patch: ProfilePatch): Promise<void>;
  /** The uid in `companies/{companyId}.createdBy`, or `null` if absent. */
  getCompanyCreator(companyId: string): Promise<string | null>;
  setCompanyCreatedByName(companyId: string, createdByName: string): Promise<void>;
  /**
   * Erases a company and everything hanging off it — files, dossiers, members
   * (the caller included), invitations, the company document. See
   * `companies/cascade.ts`.
   */
  deleteCompanyCascade(companyId: string): Promise<void>;
}

/** Splits a list into batches — Firestore caps a write batch at 500 operations. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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

function countAdmins(members: Member[]): number {
  return members.filter((m) => m.isAdmin).length;
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
  if (!input.isAdmin && countAdmins(await deps.listMembers(scope)) <= 1) {
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
 * Like {@link scopeOf}, but tolerant. Self-deletion is the one escape hatch an
 * account always keeps, so an account too broken to have a scope — a b2b user
 * whose `companyId` is missing — gets `null` and a plain self-delete rather
 * than a `permission-denied` that would strand them forever.
 */
function selfScopeOf(caller: CallerClaims): Scope | null {
  if (caller.role === "backoffice") return { kind: "backoffice" };
  if (caller.role === "b2b" && caller.companyId) {
    return { kind: "company", companyId: caller.companyId };
  }
  return null;
}

/**
 * The three refusals, verbatim from `page-my-account.md` minus the company
 * name: the client holds it, and reading it here would be a Firestore read
 * spent on an error path the client already renders itself.
 */
const SOLE_COMPANY_ADMIN =
  "Vous êtes le dernier administrateur de votre entreprise. Veuillez attribuer le " +
  "rôle Administrateur à un autre vendeur avant de supprimer votre compte.";
const SOLE_BACKOFFICE_ADMIN =
  "Vous êtes le dernier administrateur de Bike-eco. Afin de supprimer votre compte, " +
  "veuillez d'abord attribuer le rôle Administrateur à un autre membre Bike-eco.";
const LAST_BACKOFFICE_MEMBER =
  "Vous êtes le dernier membre de Bike-eco. Afin de supprimer votre compte, veuillez " +
  "d'abord inviter un nouveau membre d'équipe Bike-eco, et le promouvoir comme " +
  "administrateur.";

/** Auth first, for the same reason as `deleteColleagueCore`: a stranded profile
 *  doc is visible and fixable, a stranded Auth user is a live session with no
 *  profile. */
async function deleteSelf(uid: string, deps: UsersDeps): Promise<void> {
  await deps.deleteAuthUser(uid);
  await deps.deleteUserDoc(uid);
}

/**
 * Self-deletion. Unlike the other two this does not require an `active`
 * account: a colleague still waiting on the company's validation must be able
 * to cancel.
 *
 * An admin may delete their account, but not while the organisation still needs
 * them. Two questions, in this order — "last member?" wins over "last admin?",
 * because it subsumes it and is the only one of the two with somewhere to go:
 *
 * - **Last member of a company** — the company has no reason to outlive them,
 *   so it leaves with them, through the same cascade the back office runs.
 *   Anything else would strand the dossiers, their chats and their files with
 *   nobody able to sign in for them.
 * - **Sole admin of a company that still has vendeurs** — refused. Promoting a
 *   colleague first is the way out, and the client says so in a modal.
 * - **Back office, either case** — refused. Bike-eco has no cascade to run: it
 *   is the app, not a tenant, and the last member leaving would lock everyone
 *   out for good (`sendInvite` and `setColleagueAdmin` both require an admin
 *   caller, so nothing in the product could recover it). They are told to
 *   invite a member and promote them first.
 *
 * The three refusal messages are the fallback for the race where the last other
 * admin is demoted between the screen's read and this call; in the ordinary
 * case the client has already shown the same thing as a modal.
 */
export async function deleteMyAccountCore(
  caller: CallerClaims,
  deps: UsersDeps,
): Promise<void> {
  const me = await deps.getUser(caller.uid);
  if (!me) throw new RegError("not-found", "Compte introuvable.");

  const scope = selfScopeOf(caller);
  if (!scope) return deleteSelf(caller.uid, deps);

  const members = await deps.listMembers(scope);
  const lastMember = members.length <= 1;
  const soleAdmin = me.isAdmin && countAdmins(members) <= 1;

  if (scope.kind === "backoffice") {
    if (lastMember) throw new RegError("failed-precondition", LAST_BACKOFFICE_MEMBER);
    if (soleAdmin) throw new RegError("failed-precondition", SOLE_BACKOFFICE_ADMIN);
    return deleteSelf(caller.uid, deps);
  }

  if (lastMember) {
    // The cascade deletes every member of the company — this caller included —
    // so there is no separate self-delete to run afterwards.
    return deps.deleteCompanyCascade(scope.companyId);
  }
  if (soleAdmin) throw new RegError("failed-precondition", SOLE_COMPANY_ADMIN);
  await deleteSelf(caller.uid, deps);
}

/**
 * Self-service edit of nom / prénom / téléphone. Email is deliberately absent:
 * it is the Auth credential, not a profile field.
 *
 * A callable rather than a client write, even though `firestore.rules` already
 * lets an owner edit these three on their own document — the same values are
 * denormalized into `dossiers/{id}.submitter` and `companies/{id}.createdByName`,
 * which no client may write. Updating the profile alone would leave every
 * dossier card, dossier detail and recap email showing the old identity.
 *
 * No `status` guard: a colleague still waiting on the company's validation must
 * be able to fix a mistyped phone number.
 */
export async function updateMyProfileCore(
  input: UpdateMyProfileInput,
  caller: CallerClaims,
  deps: UsersDeps,
): Promise<void> {
  const me = await deps.getUser(caller.uid);
  if (!me) throw new RegError("not-found", "Compte introuvable.");

  // Only what genuinely differs. Re-submitting the form unchanged must not fan
  // out a write over every dossier the user has ever filed.
  const changed: ProfilePatch = {};
  for (const field of PROFILE_FIELDS) {
    const value = input[field];
    if (value !== undefined && value !== me[field]) changed[field] = value;
  }
  if (Object.keys(changed).length === 0) return;

  await deps.updateProfile(caller.uid, changed);
  await deps.propagateToDossiers(caller.uid, changed);

  // `createdByName` is a name, so a phone-only edit leaves it alone — and only
  // the member who registered the company owns that field.
  if (changed.nom === undefined && changed.prenom === undefined) return;
  if (!me.companyId) return;
  if ((await deps.getCompanyCreator(me.companyId)) !== caller.uid) return;
  const prenom = changed.prenom ?? me.prenom;
  const nom = changed.nom ?? me.nom;
  await deps.setCompanyCreatedByName(me.companyId, `${prenom} ${nom}`);
}
