import { RegError, type CallerClaims } from "../errors";
import { recapHtml, recapSubject, type RecapDossier } from "./render";
import type { DossierRecapInput } from "./schemas";

export interface DossierEmailDeps {
  getDossier(id: string): Promise<RecapDossier | null>;
  /** The caller's own profile email, or null when the account carries none. */
  getUserEmail(uid: string): Promise<string | null>;
  sendMail(mail: { to: string; subject: string; html: string }): Promise<void>;
}

/**
 * Mail the caller a recap of one dossier.
 *
 * Back-office only, and only ever to the caller's own address: the recipient is
 * resolved from the verified claims' uid, never from the payload, so the
 * callable cannot be turned into a way to mail a dossier to a third party.
 *
 * Nothing is persisted and nothing is retried — a failed send leaves no state
 * to reconcile, and the user can simply press the button again.
 */
export async function sendDossierRecapCore(
  input: DossierRecapInput,
  caller: CallerClaims,
  deps: DossierEmailDeps,
): Promise<void> {
  if (caller.role !== "backoffice") {
    throw new RegError("permission-denied", "Action non autorisée.");
  }

  const dossier = await deps.getDossier(input.dossierId);
  if (!dossier) throw new RegError("not-found", "Dossier introuvable.");

  const email = (await deps.getUserEmail(caller.uid))?.trim();
  if (!email) {
    throw new RegError(
      "failed-precondition",
      "Aucune adresse email n'est associée à votre compte.",
    );
  }

  await deps.sendMail({
    to: email,
    subject: recapSubject(dossier),
    html: recapHtml(dossier),
  });
}
