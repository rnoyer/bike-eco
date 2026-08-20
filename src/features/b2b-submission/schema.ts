import { z } from "zod";

import { MAX_PHOTOS } from "@/constants/photos";

const optionalText = z.string().optional().default("");
const optionalChoice = z.string().nullable().default(null);

/**
 * Logged-in B2B "Vendre une moto" submission. Mirrors the B2C vehicle fields
 * (identity is already known from the session, so there is no coordonnées step),
 * with "Modèle et Cylindrée" merged into a single `modele` field per the Dossier
 * model. `accessoires` holds the step-2 free-text "Commentaires (Ex. État)";
 * `commentaires` holds the step-8 pricing comment.
 */
export const b2bSubmissionSchema = z
  .object({
    electrique: z.string().default("non"),
    materiel: z.array(z.string()).default([]),
    marque: optionalText,
    modele: optionalText,
    annee: optionalText,
    kilometrage: optionalText,
    accessoires: optionalText,
    aClesContact: optionalChoice,
    cleNoire: optionalChoice,
    cleMarron: optionalChoice,
    cleRouge: optionalChoice,
    aTelecommande: optionalChoice,
    telecommande: optionalChoice,
    etat: optionalChoice,
    naturePanne: optionalText,
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
    prix: optionalText,
    commentaires: optionalText,
  })
  .refine((v) => v.marque.trim().length > 0 || v.modele.trim().length > 0, {
    message: "Renseignez la marque ou le modèle",
    path: ["marque"],
  });

export type B2bSubmissionForm = z.infer<typeof b2bSubmissionSchema>;

export const B2B_SUBMISSION_DEFAULTS: B2bSubmissionForm = {
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
};
