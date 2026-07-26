import type { ReactNode } from "react";

import { AccountFields, CoordonneesFields } from "@/features/registration/fields";
import type { StepConfig } from "@/lib/forms/useStepForm";
import type { B2bInvitedRegistrationForm } from "./schema";

export type InvitedStep = StepConfig<B2bInvitedRegistrationForm> & {
  render: () => ReactNode;
};

export const B2B_INVITED_REGISTRATION_STEPS: InvitedStep[] = [
  {
    progress: 33,
    title: "Votre compte",
    subtitle: "Informations relative à votre compte utilisateur",
    fields: ["email", "password", "confirmPassword"],
    render: () => <AccountFields emailDisabled />,
  },
  {
    progress: 66,
    title: "Vos coordonnées",
    subtitle: "Informations relative à votre compte utilisateur",
    fields: ["nom", "prenom", "telephone"],
    render: () => <CoordonneesFields />,
  },
];
