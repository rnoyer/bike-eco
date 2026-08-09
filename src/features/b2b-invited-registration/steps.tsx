import type { ReactNode } from "react";

import {
  AccountFields,
  CoordonneesFields,
  RegionGereeField,
} from "@/features/registration/fields";
import type { StepConfig } from "@/lib/forms/useStepForm";
import type { B2bInvitedRegistrationForm } from "./schema";

export type InvitedStep = StepConfig<B2bInvitedRegistrationForm> & {
  render: () => ReactNode;
};

/**
 * The invited funnel, shaped by the role the invitation carries (resolved from
 * the code before this screen). A back-office invitee also picks the "Région
 * gérée" they will manage; a b2b invitee has no région, so the field is absent
 * rather than disabled — `acceptInvite` refuses to store one for them either.
 */
export function invitedRegistrationSteps(isBackoffice: boolean): InvitedStep[] {
  return [
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
      fields: isBackoffice
        ? ["nom", "prenom", "telephone", "regionGeree"]
        : ["nom", "prenom", "telephone"],
      render: () => (
        <CoordonneesFields>
          {isBackoffice ? <RegionGereeField /> : null}
        </CoordonneesFields>
      ),
    },
  ];
}
