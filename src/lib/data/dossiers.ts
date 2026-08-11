import { call } from "./callable";

/** Permanently delete a dossier, its messages and its Storage files.
 *  Back-office only — the callable rejects anyone else. */
export const callDeleteDossier = (dossierId: string) =>
  call<{ dossierId: string }, { ok: true }>("deleteDossier", { dossierId }).then(
    () => undefined,
  );
