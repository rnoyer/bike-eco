import { call } from "./callable";

export interface RegisterCompanyPayload {
  method: "password" | "google";
  siret: string;
  companyName: string;
  companyDepartement: string;
  companyVille: string;
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
  password?: string;
}
export interface AcceptInvitePayload {
  method: "password" | "google";
  code: string;
  nom: string;
  prenom: string;
  telephone: string;
  password?: string;
}

export const callRegisterCompany = (p: RegisterCompanyPayload) =>
  call<RegisterCompanyPayload, { ok: true }>("registerCompany", p).then(() => undefined);
export const callSendInvite = (email: string) =>
  call<{ email: string }, { ok: true }>("sendInvite", { email }).then(() => undefined);
export const callResolveInvite = (code: string) =>
  call<{ code: string }, { email: string; companyName: string }>("resolveInvite", { code });
export const callAcceptInvite = (p: AcceptInvitePayload) =>
  call<AcceptInvitePayload, { ok: true }>("acceptInvite", p).then(() => undefined);
export const callApproveCompany = (companyId: string) =>
  call<{ companyId: string }, { ok: true }>("approveCompany", { companyId }).then(() => undefined);
export const callDeleteCompany = (companyId: string) =>
  call<{ companyId: string }, { ok: true }>("deleteCompany", { companyId }).then(() => undefined);
