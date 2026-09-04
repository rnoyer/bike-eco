import { z } from "zod";

import { MAX_PHOTOS } from "@/constants/photos";
import {
  FREE_TEXT_MAX,
  IMMATRICULATION_MAX,
  NUMBER_TEXT_MAX,
  SHORT_TEXT_MAX,
} from "@/constants/vehicle";
import { clearUnaskedCheckboxes } from "@/features/vehicle-submission/normalize";

const optionalChoice = z.string().nullable().default(null);

/** Single-line free text (marque, ville, nature de la panne…). */
const shortText = z
  .string()
  .max(SHORT_TEXT_MAX, `Ce champ ne peut dépasser ${SHORT_TEXT_MAX} caractères`)
  .optional()
  .default("");

/** Multiline free text (accessoires, commentaires). */
const longText = z
  .string()
  .max(FREE_TEXT_MAX, `Ce champ ne peut dépasser ${FREE_TEXT_MAX} caractères`)
  .optional()
  .default("");

/** A digit string from a numeric input (`digitsOnly` already strips the rest). */
const numberText = z
  .string()
  .max(NUMBER_TEXT_MAX, `Ce nombre ne peut dépasser ${NUMBER_TEXT_MAX} chiffres`)
  .optional()
  .default("");

/** Optional plate. Trimmed and length-capped, not pattern-matched: the funnel
 *  also takes foreign and not-yet-registered vehicles. */
const immatriculation = z
  .string()
  .trim()
  .max(
    IMMATRICULATION_MAX,
    `Le numéro d'immatriculation ne peut dépasser ${IMMATRICULATION_MAX} caractères`,
  )
  .optional()
  .default("");

/**
 * Logged-in B2B "Vendre une moto" submission. Mirrors the B2C vehicle fields
 * (identity is already known from the session, so there is no coordonnées step),
 * with "Modèle et Cylindrée" merged into a single `modele` field per the Dossier
 * model. `accessoires` holds the step-2 free-text "Commentaires (Ex. État)";
 * `commentaires` holds the step-8 pricing comment.
 */
export const b2bSubmissionSchema = z
  .object({
    stock: optionalChoice,
    immatriculation,
    electrique: z.string().default("non"),
    materiel: z.array(z.string()).default([]),
    marque: shortText,
    modele: shortText,
    annee: numberText,
    kilometrage: numberText,
    accessoires: longText,
    aClesContact: optionalChoice,
    cleNoire: optionalChoice,
    cleMarron: optionalChoice,
    cleRouge: optionalChoice,
    aKeyless: optionalChoice,
    keyless: z.array(z.string()).default([]),
    etat: optionalChoice,
    naturePanne: shortText,
    carteGrise: optionalChoice,
    carteGriseAVotreNom: optionalChoice,
    controleTechnique: optionalChoice,
    ctMoins6Mois: optionalChoice,
    resultatCT: optionalChoice,
    certificatNonGage: optionalChoice,
    carnetEntretien: optionalChoice,
    factureEntretien: optionalChoice,
    photos: z
      .array(z.string())
      .min(1, "Ajoutez au moins 1 photo récente")
      .max(MAX_PHOTOS, `Ajoutez ${MAX_PHOTOS} photos maximum`),
    prix: numberText,
    commentaires: longText,
  })
  .refine((v) => v.marque.trim().length > 0 || v.modele.trim().length > 0, {
    message: "Renseignez la marque ou le modèle",
    path: ["marque"],
  })
  // Runs last, on the parsed object: a checkbox group whose parent question is
  // not "oui" never leaves the funnel populated. See `clearUnaskedCheckboxes`.
  .transform(clearUnaskedCheckboxes);

export type B2bSubmissionForm = z.infer<typeof b2bSubmissionSchema>;

export const B2B_SUBMISSION_DEFAULTS: B2bSubmissionForm = {
  stock: null,
  immatriculation: "",
  electrique: "non",
  materiel: [],
  marque: "",
  modele: "",
  annee: "",
  kilometrage: "",
  accessoires: "",
  aClesContact: null,
  cleNoire: null,
  cleMarron: null,
  cleRouge: null,
  aKeyless: null,
  keyless: [],
  etat: null,
  naturePanne: "",
  carteGrise: null,
  carteGriseAVotreNom: null,
  controleTechnique: null,
  ctMoins6Mois: null,
  resultatCT: null,
  certificatNonGage: null,
  carnetEntretien: null,
  factureEntretien: null,
  photos: [],
  prix: "",
  commentaires: "",
};
