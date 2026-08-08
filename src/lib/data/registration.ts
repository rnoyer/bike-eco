import { call } from "./callable";
import type { Region, UserRole } from "@/lib/firestore/schema";

export interface RegisterCompanyPayload {
  method: "password" | "google";
  siret: string;
  tva?: string; // optional VAT number — "FR" + key + the SIRET's SIREN
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
  /** Back-office invitations only: the "région gérée" the new member picks at
   *  registration. `null` = "Toute la France"; ignored for a b2b invitation. */
  notificationRegion?: Region | null;
}

export const callRegisterCompany = (p: RegisterCompanyPayload) =>
  call<RegisterCompanyPayload, { ok: true }>("registerCompany", p).then(() => undefined);
export const callSendInvite = (email: string) =>
  call<{ email: string }, { ok: true }>("sendInvite", { email }).then(() => undefined);
export const callResolveInvite = (code: string) =>
  call<{ code: string }, { email: string; role: UserRole; organisationName: string }>(
    "resolveInvite",
    { code },
  );
export const callAcceptInvite = (p: AcceptInvitePayload) =>
  call<AcceptInvitePayload, { ok: true }>("acceptInvite", p).then(() => undefined);
export const callApproveCompany = (companyId: string) =>
  call<{ companyId: string }, { ok: true }>("approveCompany", { companyId }).then(() => undefined);
export const callDeleteCompany = (companyId: string) =>
  call<{ companyId: string }, { ok: true }>("deleteCompany", { companyId }).then(() => undefined);
