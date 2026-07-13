import { z } from "zod";

const requiredText = (message: string) => z.string().trim().min(1, message);

/** B2B company signup (SIRET + company, account, contact). */
export const b2bCompanyRegistrationSchema = z.object({
  siret: z.string().regex(/^\d{14}$/, "Saisissez un numéro SIRET à 14 chiffres"),
  companyName: requiredText("Indiquez le nom de votre entreprise"),
  email: z.email("Saisissez un email valide"),
  password: z.string().min(8, "8 caractères minimum"),
  nom: requiredText("Indiquez votre nom"),
  prenom: requiredText("Indiquez votre prénom"),
  telephone: z.string().regex(/^\d{10}$/, "Saisissez un numéro à 10 chiffres"),
  departement: requiredText("Sélectionnez un département"),
  ville: requiredText("Indiquez votre ville"),
});

export type B2bCompanyRegistrationForm = z.infer<typeof b2bCompanyRegistrationSchema>;

export const B2B_COMPANY_REGISTRATION_DEFAULTS: B2bCompanyRegistrationForm = {
  siret: "",
  companyName: "",
  email: "",
  password: "",
  nom: "",
  prenom: "",
  telephone: "",
  departement: "",
  ville: "",
};
