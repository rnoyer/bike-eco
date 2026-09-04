import { z } from "zod";

import { MAX_PHOTOS } from "@/constants/photos";
import {
  FREE_TEXT_MAX,
  IMMATRICULATION_MAX,
  NUMBER_TEXT_MAX,
  SHORT_TEXT_MAX,
} from "@/constants/vehicle";
import { clearUnaskedCheckboxes } from "@/features/vehicle-submission/normalize";

const requiredText = (message = "Ce champ est obligatoire") =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(SHORT_TEXT_MAX, `Ce champ ne peut dépasser ${SHORT_TEXT_MAX} caractères`);

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

/** Optional single-choice dropdowns default to null until picked. */
const optionalChoice = z.string().nullable().default(null);

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
 * Single source of truth for the public B2C vehicle-submission funnel.
 * Field types mirror the inputs (strings), and validation follows the spec's
 * mandatory flags. Derive types from this schema — never redeclare them.
 */
export const b2cSubmissionSchema = z
  .object({
    // Step 1 — coordonnées (all mandatory)
    nom: requiredText(),
    prenom: requiredText(),
    // 254 is the maximum length of an email address (RFC 5321); `functions/src/
    // payload.ts` caps it identically, so a value this side accepts is one the
    // endpoint accepts.
    email: z.email("Saisissez un email valide").max(254, "Saisissez un email valide"),
    telephone: z.string().regex(/^\d{10}$/, "Saisissez un numéro à 10 chiffres"),
    departement: requiredText("Sélectionnez un département"),
    ville: requiredText(),

    // Step 2 — véhicule électrique
    immatriculation,
    electrique: z.string().default("non"),
    materiel: z.array(z.string()).default([]),

    // Step 3 — informations véhicule
    marque: shortText,
    modele: shortText,
    cylindree: numberText,
    annee: numberText,
    kilometrage: numberText,
    accessoires: longText,

    // Step 4 — clés et télécommandes
    aClesContact: optionalChoice,
    cleNoire: optionalChoice,
    cleMarron: optionalChoice,
    cleRouge: optionalChoice,
    aKeyless: optionalChoice,
    keyless: z.array(z.string()).default([]),

    // Step 5 — état
    etat: optionalChoice,
    naturePanne: shortText,

    // Step 6 — papiers
    carteGrise: optionalChoice,
    carteGriseAVotreNom: optionalChoice,
    controleTechnique: optionalChoice,
    ctMoins6Mois: optionalChoice,
    resultatCT: optionalChoice,
    certificatNonGage: optionalChoice,
    carnetEntretien: optionalChoice,
    factureEntretien: optionalChoice,

    // Step 7 — photos
    photos: z
      .array(z.string())
      .min(1, "Ajoutez au moins 1 photo récente")
      .max(MAX_PHOTOS, `Ajoutez ${MAX_PHOTOS} photos maximum`),

    // Step 8 — prix
    prix: numberText,
    commentaires: longText,

    // Step 9 — modalités de reprise
    modalite: optionalChoice,
  })
  // Runs last, on the parsed object: a checkbox group whose parent question is
  // not "oui" never leaves the funnel populated. See `clearUnaskedCheckboxes`.
  .transform(clearUnaskedCheckboxes);

export type B2cSubmissionForm = z.infer<typeof b2cSubmissionSchema>;

export const B2C_SUBMISSION_DEFAULTS: B2cSubmissionForm = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  departement: "",
  ville: "",
  immatriculation: "",
  electrique: "non",
  materiel: [],
  marque: "",
  modele: "",
  cylindree: "",
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
  modalite: null,
};
