import { z } from "zod";

/**
 * Server-side mirror of the B2C funnel payload (see the app's
 * `src/features/b2c-submission/schema.ts`). The client strips `photos` from the
 * JSON and sends them as multipart files, so they are NOT part of this schema —
 * the handler validates the attached files separately.
 *
 * Validation here is intentionally lenient on the optional fields (the funnel
 * already enforces them client-side); the goal is to reject obviously malformed
 * requests and guarantee the fields the emails rely on are present.
 */
export const b2cPayloadSchema = z.object({
  // Step 1 — coordonnées (required)
  nom: z.string().trim().min(1),
  prenom: z.string().trim().min(1),
  email: z.email(),
  telephone: z.string().regex(/^\d{10}$/),
  departement: z.string().trim().min(1),
  ville: z.string().trim().min(1),

  // Step 2 — véhicule électrique
  electrique: z.string().default("non"),
  materiel: z.array(z.string()).default([]),

  // Step 3 — informations véhicule
  marque: z.string().default(""),
  modele: z.string().default(""),
  cylindree: z.string().default(""),
  annee: z.string().default(""),
  kilometrage: z.string().default(""),
  accessoires: z.string().default(""),

  // Step 4 — clés et télécommandes
  aClesContact: z.string().nullable().default(null),
  cleNoire: z.string().nullable().default(null),
  cleMarron: z.string().nullable().default(null),
  cleRouge: z.string().nullable().default(null),
  aTelecommande: z.string().nullable().default(null),
  telecommande: z.string().nullable().default(null),

  // Step 5 — état
  etat: z.string().nullable().default(null),
  naturePanne: z.string().default(""),

  // Step 6 — papiers
  carteGrise: z.string().nullable().default(null),
  carteGriseAVotreNom: z.string().nullable().default(null),
  controleTechnique: z.string().nullable().default(null),
  ctMoins6Mois: z.string().nullable().default(null),
  resultatCT: z.string().nullable().default(null),
  certificatNonGage: z.string().nullable().default(null),
  carnetEntretien: z.string().nullable().default(null),
  factureEntretien: z.string().nullable().default(null),

  // Step 8 — prix
  prix: z.string().default(""),
  commentaires: z.string().default(""),

  // Step 9 — modalités de reprise
  modalite: z.string().nullable().default(null),
});

export type B2cPayload = z.infer<typeof b2cPayloadSchema>;
