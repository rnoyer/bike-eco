import { RegError, type CallerClaims } from "../errors";
import { isDossierPhotoUrl } from "../storageUrl";
import { recapHtml, recapSubject, type RecapDossier } from "./render";
import type { DossierRecapInput } from "./schemas";

export interface DossierEmailDeps {
  /** Our own Storage bucket, which the recap's photo links must point at, or
   *  `null` when the runtime does not expose it. */
  storageBucket: string | null;
  getDossier(id: string): Promise<RecapDossier | null>;
  /** The caller's own address, read from Firebase Auth (not the client-writable
   *  `users/{uid}.email` profile field), or null when the account carries none. */
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
  if (caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée aux comptes actifs.");
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

  // `photos` is written by the dealer's own client and the create rule does not
  // constrain it (firestore.rules), so an entry is only linked once it is shown
  // to be a download URL for this dossier's own photo folder in our own bucket.
  // Without it a dealer could plant any link in a mail the back office opens as
  // ours. Anything else is dropped silently — a recap is not the place to
  // report it, and the photos are visible in the app either way.
  const photos = (dossier.photos ?? []).filter((url) =>
    isDossierPhotoUrl(url, {
      bucket: deps.storageBucket,
      companyId: dossier.companyId,
      dossierId: input.dossierId,
    }),
  );

  await deps.sendMail({
    to: email,
    subject: recapSubject(dossier),
    // The clock lives here rather than inside the renderer, which stays a pure
    // function of its inputs. Every send stamps its own generation time, which
    // is what stops Gmail trimming a resend away as repeated content.
    html: recapHtml({ ...dossier, photos }, new Date()),
  });
}
