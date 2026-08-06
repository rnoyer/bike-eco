import { z } from "zod";

import { tvaIssue } from "@/lib/forms/tva";

const requiredText = (message: string) => z.string().trim().min(1, message);

/** B2B company signup (SIRET + company, account, contact). */
export const b2bCompanyRegistrationSchema = z
  .object({
    siret: z.string().regex(/^\d{14}$/, "Saisissez un numéro SIRET à 14 chiffres"),
    /** Optional; when filled it must be `FR` + key + the SIRET's SIREN (see `lib/forms/tva`). */
    tva: z.string(),
    companyName: requiredText("Indiquez le nom de votre entreprise"),
    companyDepartement: requiredText("Sélectionnez le département de l'entreprise"),
    companyVille: requiredText("Indiquez la ville de l'entreprise"),
    email: z.email("Saisissez un email valide"),
    password: z.string().min(8, "8 caractères minimum"),
    confirmPassword: z.string(),
    nom: requiredText("Indiquez votre nom"),
    prenom: requiredText("Indiquez votre prénom"),
    telephone: z.string().regex(/^\d{10}$/, "Saisissez un numéro à 10 chiffres"),
  })
  // Attached to `confirmPassword` so the message renders under the box the user
  // must fix, and so the account step's `trigger` sees it (a failing sibling
  // field does not suppress this check — Zod only skips it on aborting issues,
  // which would themselves error on `confirmPassword`).
  .refine((v) => v.password === v.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  })
  // Cross-field like the password check above: the TVA number is validated
  // against the SIRET typed on the same step, and the issue is attached to the
  // TVA field so the company step's `trigger` blocks "Suivant" on it.
  .superRefine((v, ctx) => {
    const message = tvaIssue(v.tva, v.siret);
    if (message) ctx.addIssue({ code: "custom", message, path: ["tva"] });
  });

export type B2bCompanyRegistrationForm = z.infer<typeof b2bCompanyRegistrationSchema>;

export const B2B_COMPANY_REGISTRATION_DEFAULTS: B2bCompanyRegistrationForm = {
  siret: "",
  tva: "",
  companyName: "",
  companyDepartement: "",
  companyVille: "",
  email: "",
  password: "",
  confirmPassword: "",
  nom: "",
  prenom: "",
  telephone: "",
};
