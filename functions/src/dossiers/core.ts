import { assertBackoffice, RegError, type CallerClaims } from "../errors";
import type { DeleteDossierInput } from "./schemas";

export interface DossierDeleteDeps {
  /** The dossier's `companyId`, which forms the Storage prefix, or null when
   *  no such document exists. */
  getDossier(id: string): Promise<{ companyId: string } | null>;
  /** Deletes every object under `dossiers/{companyId}/{dossierId}/`. */
  deleteStorage(companyId: string, dossierId: string): Promise<void>;
  /** Deletes the document *and* its subcollections. */
  deleteDossier(id: string): Promise<void>;
}

/**
 * Permanently delete one dossier: its Storage folder, then its document and
 * every subcollection under it (`messages`, `mutes`).
 *
 * Back-office only. The `companyId` that forms the Storage prefix is read from
 * the stored document, never from the payload — otherwise the callable would
 * be a way to aim a prefixed delete at another company's files.
 *
 * Storage first, Firestore second, mirroring `deleteCompanyCore`. If the
 * document delete fails after the files are gone, the dossier is still
 * readable but its images 404 — visible, and fixed by pressing the button
 * again. The reverse order would leave files that no document points at,
 * invisible to every screen and reachable only with bucket access.
 */
export async function deleteDossierCore(
  input: DeleteDossierInput,
  caller: CallerClaims,
  deps: DossierDeleteDeps,
): Promise<void> {
  assertBackoffice(caller);

  const dossier = await deps.getDossier(input.dossierId);
  if (!dossier) throw new RegError("not-found", "Dossier introuvable.");

  await deps.deleteStorage(dossier.companyId, input.dossierId);
  await deps.deleteDossier(input.dossierId);
}
