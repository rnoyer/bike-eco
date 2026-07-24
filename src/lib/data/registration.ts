import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "../../../firebase.core";

/** Firebase callable errors carry a `code` like "functions/already-exists"; map to French. */
function frenchError(error: unknown): Error {
  const code = (error as FunctionsError)?.code ?? "";
  const messages: Record<string, string> = {
    "functions/already-exists": "Une entreprise avec ce SIRET est déjà enregistrée.",
    "functions/permission-denied": "Action non autorisée.",
    "functions/not-found": "Code d'invitation invalide ou expiré.",
    "functions/unauthenticated": "Connexion requise.",
    "functions/unavailable": "Connexion impossible. Vérifiez votre réseau.",
    "functions/invalid-argument": "Données du formulaire invalides.",
    "functions/internal": "Une erreur est survenue. Veuillez réessayer.",
    "functions/failed-precondition": "Cette entreprise n'est pas en attente de validation.",
  };
  // A thrown HttpsError message is server-authored French; prefer it when present.
  const serverMsg = (error as { message?: string })?.message;
  return new Error(serverMsg ?? messages[code] ?? "Une erreur est survenue. Veuillez réessayer.");
}

async function call<T, R>(name: string, data: T): Promise<R> {
  try {
    const fn = httpsCallable<T, R>(functions, name);
    return (await fn(data)).data;
  } catch (error) {
    throw frenchError(error);
  }
}

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
