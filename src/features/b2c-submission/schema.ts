import { z } from "zod";

import { MAX_PHOTOS } from "@/constants/photos";

const requiredText = (message = "Ce champ est obligatoire") =>
  z.string().trim().min(1, message);

/** Optional free-text / numeric inputs default to an empty string. */
const optionalText = z.string().optional().default("");

/** Optional single-choice dropdowns default to null until picked. */
const optionalChoice = z.string().nullable().default(null);

/**
 * Single source of truth for the public B2C vehicle-submission funnel.
 * Field types mirror the inputs (strings), and validation follows the spec's
 * mandatory flags. Derive types from this schema — never redeclare them.
 */
export const b2cSubmissionSchema = z.object({
  // Step 1 — coordonnées (all mandatory)
  nom: requiredText(),
  prenom: requiredText(),
  email: z.email("Saisissez un email valide"),
  telephone: z.string().regex(/^\d{10}$/, "Saisissez un numéro à 10 chiffres"),
  departement: requiredText("Sélectionnez un département"),
  ville: requiredText(),

  // Step 2 — véhicule électrique
  electrique: z.string().default("non"),
  materiel: z.array(z.string()).default([]),

  // Step 3 — informations véhicule
  marque: optionalText,
  modele: optionalText,
  cylindree: optionalText,
  annee: optionalText,
  kilometrage: optionalText,
  accessoires: optionalText,

  // Step 4 — clés et télécommandes
  aClesContact: optionalChoice,
  cleNoire: optionalChoice,
  cleMarron: optionalChoice,
  cleRouge: optionalChoice,
  aTelecommande: optionalChoice,
  telecommande: optionalChoice,

  // Step 5 — état
  etat: optionalChoice,
  naturePanne: optionalText,

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
    .min(1, "Ajoutez au moins 1 photo du véhicule")
    .max(MAX_PHOTOS, `Ajoutez ${MAX_PHOTOS} photos maximum`),

  // Step 8 — prix
  prix: optionalText,
  commentaires: optionalText,

  // Step 9 — modalités de reprise
  modalite: optionalChoice,
});

export type B2cSubmissionForm = z.infer<typeof b2cSubmissionSchema>;

export const B2C_SUBMISSION_DEFAULTS: B2cSubmissionForm = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  departement: "",
  ville: "",
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
  aTelecommande: null,
  telecommande: null,
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
