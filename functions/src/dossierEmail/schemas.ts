import { z } from "zod";

// A single path segment only: letters, digits, underscore, hyphen — what
// Firestore auto-ids and this project's own ids are made of. Without this, a
// value like "dos_1/messages/msg_1" reaches `db().collection("dossiers").doc(id)`
// as a multi-segment path and resolves to an unrelated document, which then
// throws inside the renderer instead of failing the schema.
const DOSSIER_ID = /^[A-Za-z0-9_-]+$/;

export const dossierRecapSchema = z.object({
  dossierId: z.string().trim().min(1).regex(DOSSIER_ID),
});

export type DossierRecapInput = z.infer<typeof dossierRecapSchema>;
