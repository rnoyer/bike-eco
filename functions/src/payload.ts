import { z } from "zod";

/**
 * Server-side mirror of the B2C funnel payload (see the app's
 * `src/features/b2c-submission/schema.ts`). The client strips `photos` from the
 * JSON and sends them as multipart files, so they are NOT part of this schema —
 * the handler validates the attached files separately.
 *
 * Validation here stays lenient on *which* values the optional fields hold (the
 * funnel already constrains them client-side); the goal is to reject obviously
 * malformed requests and guarantee the fields the emails rely on are present.
 *
 * It is **not** lenient on size. This endpoint is public and unauthenticated —
 * `sendB2cSubmission` is an `onRequest`, not a callable — so every string is
 * capped. Busboy's `fieldSize` bounds the payload part as a whole, but without
 * per-field caps a single 100 kB "marque" still reaches the email templates and
 * is inlined into a mail nobody can read.
 */

// Mirrors `SHORT_TEXT_MAX` / `FREE_TEXT_MAX` / `NUMBER_TEXT_MAX` /
// `IMMATRICULATION_MAX` in `src/constants/vehicle.ts`. Duplicated for the same
// reason as `regions.ts` and `labels.ts`: this package compiles in isolation
// and cannot import app sources. Keep both copies in sync.
const SHORT_TEXT_MAX = 120;
const FREE_TEXT_MAX = 2000;
const NUMBER_TEXT_MAX = 9;
const IMMATRICULATION_MAX = 15;

/** A dropdown answer. Stored as its French label, the longest of which is the
 *  "Je dépose la moto au centre de …" modalité, so this leaves headroom. */
const CHOICE_MAX = 80;

/** A checkbox group sends the checked labels; the longest list defined today is
 *  two long. The cap is what stops an unbounded array reaching the templates. */
const CHECKBOX_ITEMS_MAX = 10;

const shortText = z.string().max(SHORT_TEXT_MAX).default("");
const longText = z.string().max(FREE_TEXT_MAX).default("");
const numberText = z.string().max(NUMBER_TEXT_MAX).default("");
const choice = z.string().max(CHOICE_MAX).nullable().default(null);
const checkedLabels = z
  .array(z.string().max(CHOICE_MAX))
  .max(CHECKBOX_ITEMS_MAX)
  .default([]);

export const b2cPayloadSchema = z
  .object({
    // Step 1 — coordonnées (required)
    nom: z.string().trim().min(1).max(SHORT_TEXT_MAX),
    prenom: z.string().trim().min(1).max(SHORT_TEXT_MAX),
    // 254 is the maximum length of an email address (RFC 5321).
    email: z.email().max(254),
    telephone: z.string().regex(/^\d{10}$/),
    departement: z.string().trim().min(1).max(SHORT_TEXT_MAX),
    ville: z.string().trim().min(1).max(SHORT_TEXT_MAX),

    // Step 2 — véhicule électrique
    immatriculation: z.string().max(IMMATRICULATION_MAX).default(""),
    electrique: z.string().max(CHOICE_MAX).default("non"),
    materiel: checkedLabels,

    // Step 3 — informations véhicule
    marque: shortText,
    modele: shortText,
    cylindree: numberText,
    annee: numberText,
    kilometrage: numberText,
    accessoires: longText,

    // Step 4 — clés
    aClesContact: choice,
    cleNoire: choice,
    cleMarron: choice,
    cleRouge: choice,
    aKeyless: choice,
    keyless: checkedLabels,

    // Step 5 — état
    etat: choice,
    naturePanne: shortText,

    // Step 6 — papiers
    carteGrise: choice,
    carteGriseAVotreNom: choice,
    controleTechnique: choice,
    ctMoins6Mois: choice,
    resultatCT: choice,
    certificatNonGage: choice,
    carnetEntretien: choice,
    factureEntretien: choice,

    // Step 8 — prix
    prix: numberText,
    commentaires: longText,

    // Step 9 — modalités de reprise
    modalite: choice,
  })
  // Mirrors `clearUnaskedCheckboxes` in
  // `src/features/vehicle-submission/normalize.ts`: a checkbox group whose
  // parent question is not "oui" is dropped, so the emails can never read
  // "Électrique : Non" followed by "Matériel : J'ai la batterie". The client
  // already normalises, but this endpoint is public — it cannot take the
  // client's word for it.
  .transform((v) => ({
    ...v,
    materiel: v.electrique === "oui" ? v.materiel : [],
    keyless: v.aKeyless === "oui" ? v.keyless : [],
  }));

export type B2cPayload = z.infer<typeof b2cPayloadSchema>;
