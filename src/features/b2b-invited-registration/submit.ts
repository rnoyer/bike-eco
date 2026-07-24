import { callAcceptInvite } from "@/lib/data/registration";
import type { B2bInvitedRegistrationForm } from "./schema";

/** Password-path invited registration: the Cloud Function validates the code and
 *  creates the ACTIVE account. Sign-in is deferred to the confirmation's
 *  "Aller à l'accueil" so the guard can't preempt the confirmation screen. */
export async function submitInvitedRegistration(
  values: B2bInvitedRegistrationForm & { code: string },
): Promise<void> {
  await callAcceptInvite({
    method: "password", code: values.code,
    nom: values.nom, prenom: values.prenom, telephone: values.telephone,
    password: values.password,
  });
}
