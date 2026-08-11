import { z } from "zod";

// A single path segment only: letters, digits, underscore, hyphen — what
// Firestore auto-ids and this project's own ids are made of. Without this, a
// value like "dos_1/messages/msg_1" reaches `db().collection("dossiers").doc(id)`
// as a multi-segment path and resolves to an unrelated document — which here
// would mean deleting the wrong thing.
const DOSSIER_ID = /^[A-Za-z0-9_-]+$/;

export const deleteDossierSchema = z.object({
  dossierId: z.string().trim().min(1).regex(DOSSIER_ID),
});

export type DeleteDossierInput = z.infer<typeof deleteDossierSchema>;
