import { z } from "zod";

const requiredText = (message: string) => z.string().trim().min(1, message);

/** Invited team-member registration (email prefilled from the invite link). */
export const b2bInvitedRegistrationSchema = z
  .object({
    email: z.email("Saisissez un email valide"),
    password: z.string().min(8, "8 caractères minimum"),
    confirmPassword: z.string(),
    nom: requiredText("Indiquez votre nom"),
    prenom: requiredText("Indiquez votre prénom"),
    telephone: z.string().regex(/^\d{10}$/, "Saisissez un numéro à 10 chiffres"),
  })
  // See the company schema: the issue goes on `confirmPassword` so the account
  // step gates on it and the message renders under the confirmation box.
  .refine((v) => v.password === v.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type B2bInvitedRegistrationForm = z.infer<typeof b2bInvitedRegistrationSchema>;

export const B2B_INVITED_REGISTRATION_DEFAULTS: B2bInvitedRegistrationForm = {
  email: "",
  password: "",
  confirmPassword: "",
  nom: "",
  prenom: "",
  telephone: "",
};
