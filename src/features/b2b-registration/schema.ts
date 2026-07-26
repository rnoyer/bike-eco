import { z } from "zod";

const requiredText = (message: string) => z.string().trim().min(1, message);

/** B2B company signup (SIRET + company, account, contact). */
export const b2bCompanyRegistrationSchema = z
  .object({
    siret: z.string().regex(/^\d{14}$/, "Saisissez un numéro SIRET à 14 chiffres"),
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
  });

export type B2bCompanyRegistrationForm = z.infer<typeof b2bCompanyRegistrationSchema>;

export const B2B_COMPANY_REGISTRATION_DEFAULTS: B2bCompanyRegistrationForm = {
  siret: "",
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
