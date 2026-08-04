import { generateInviteCode, hashInviteCode, INVITE_TTL_MS } from "./inviteCode";
import { resolveRegion } from "../regions";
import type {
  AcceptInviteInput,
  RegisterCompanyInput,
  ResolveInviteInput,
  SendInviteInput,
} from "./schemas";
import { RegError, type CallerClaims } from "../errors";

export interface StoredInvitation {
  id: string;
  email: string;
  companyId: string;
  companyName: string;
  tokenHash: string;
  expiresAt: number; // epoch ms
}

export interface Deps {
  createUser(email: string, password: string): Promise<string>;
  setClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
  companyExistsForSiret(siret: string): Promise<boolean>;
  writeCompany(id: string, data: Record<string, unknown>): Promise<void>;
  writeUser(uid: string, data: Record<string, unknown>): Promise<void>;
  newCompanyId(siret: string): string;
  newDocumentId(): string;
  findInvitationByHash(hash: string): Promise<StoredInvitation | null>;
  writeInvitation(id: string, data: Record<string, unknown>): Promise<void>;
  deleteInvitation(id: string): Promise<void>;
  now(): number;
  sendApplicantEmail(to: string, companyName: string): Promise<void>;
  sendInviteEmail(to: string, code: string): Promise<void>;
}

function profileDoc(
  input: { nom: string; prenom: string; telephone: string },
  email: string,
  companyId: string,
  status: "pending" | "active",
  isAdmin: boolean,
) {
  return {
    role: "b2b", companyId, isAdmin,
    nom: input.nom, prenom: input.prenom, email,
    telephone: input.telephone,
    status,
  };
}

export async function registerCompanyCore(
  input: RegisterCompanyInput,
  authUid: string | null,
  authEmail: string | null,
  deps: Deps,
): Promise<void> {
  if (await deps.companyExistsForSiret(input.siret)) {
    throw new RegError("already-exists", "Une entreprise avec ce SIRET est déjà enregistrée.");
  }
  let uid: string;
  let email: string;
  if (input.method === "password") {
    uid = await deps.createUser(input.email, input.password);
    email = input.email;
  } else {
    if (!authUid || !authEmail) throw new RegError("unauthenticated", "Connexion Google requise.");
    uid = authUid;
    email = authEmail;
  }
  const companyId = deps.newCompanyId(input.siret);
  await deps.writeCompany(companyId, {
    siret: input.siret,
    name: input.companyName,
    status: "pending",
    departement: input.companyDepartement,
    ville: input.companyVille,
    region: resolveRegion(input.companyDepartement),
    createdBy: uid,
    createdByName: `${input.prenom} ${input.nom}`,
    validatedAt: null,
  });
  await deps.writeUser(uid, profileDoc(input, email, companyId, "pending", true));
  await deps.setClaims(uid, { role: "b2b", companyId, status: "pending" });
  await deps.sendApplicantEmail(email, input.companyName);
}

export async function sendInviteCore(
  input: SendInviteInput,
  caller: CallerClaims,
  deps: Deps,
): Promise<void> {
  if (caller.role !== "b2b" || caller.status !== "active" || !caller.companyId) {
    throw new RegError("permission-denied", "Seul un compte vendeur actif peut inviter.");
  }
  const code = generateInviteCode();
  const id = deps.newDocumentId();
  await deps.writeInvitation(id, {
    email: input.email, companyId: caller.companyId, invitedBy: caller.uid,
    tokenHash: hashInviteCode(code), status: "pending", expiresAt: deps.now() + INVITE_TTL_MS,
  });
  await deps.sendInviteEmail(input.email, code);
}

export async function resolveInviteCore(
  input: ResolveInviteInput,
  deps: Deps,
): Promise<{ email: string; companyName: string }> {
  const inv = await deps.findInvitationByHash(hashInviteCode(input.code));
  if (!inv) throw new RegError("not-found", "Code d'invitation invalide ou expiré.");
  if (inv.expiresAt <= deps.now()) {
    await deps.deleteInvitation(inv.id);
    throw new RegError("not-found", "Code d'invitation invalide ou expiré.");
  }
  return { email: inv.email, companyName: inv.companyName };
}

export async function acceptInviteCore(
  input: AcceptInviteInput,
  authUid: string | null,
  authEmail: string | null,
  deps: Deps,
): Promise<void> {
  const inv = await deps.findInvitationByHash(hashInviteCode(input.code));
  if (!inv || inv.expiresAt <= deps.now()) {
    if (inv) await deps.deleteInvitation(inv.id);
    throw new RegError("not-found", "Code d'invitation invalide ou expiré.");
  }
  let uid: string;
  if (input.method === "password") {
    uid = await deps.createUser(inv.email, input.password!);
  } else {
    if (!authUid || !authEmail) throw new RegError("unauthenticated", "Connexion Google requise.");
    if (authEmail.toLowerCase() !== inv.email.toLowerCase()) {
      throw new RegError("permission-denied", "Ce compte Google ne correspond pas à l'invitation.");
    }
    uid = authUid;
  }
  await deps.writeUser(uid, profileDoc(input, inv.email, inv.companyId, "active", false));
  await deps.setClaims(uid, { role: "b2b", companyId: inv.companyId, status: "active" });
  await deps.deleteInvitation(inv.id);
}
