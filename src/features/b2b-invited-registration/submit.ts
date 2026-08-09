import { callAcceptInvite } from "@/lib/data/registration";
import { regionFromLabel } from "@/lib/navigation/regionOptions";
import type { B2bInvitedRegistrationForm } from "./schema";

/** Invited registration: the Cloud Function validates the code and creates the
 *  ACTIVE account. In password mode sign-in is deferred to the confirmation's
 *  "Aller à l'accueil" so the guard can't preempt the confirmation screen; in
 *  Google mode the identity already exists (step 1 signed in), so no password
 *  travels — the seeded placeholder from `AccountFields` must not be sent.
 *  Both modes go through here so the form-values → payload mapping (notably
 *  the "Région gérée" label → `notificationRegion`) lives in one place. */
export async function submitInvitedRegistration(
  values: B2bInvitedRegistrationForm & { code: string },
  method: "password" | "google" = "password",
): Promise<void> {
  await callAcceptInvite({
    method, code: values.code,
    nom: values.nom, prenom: values.prenom, telephone: values.telephone,
    ...(method === "password" ? { password: values.password } : {}),
    // Back-office invitees only — the field is absent from a b2b invitee's
    // form, and `acceptInvite` ignores it for a b2b invitation anyway.
    notificationRegion: regionFromLabel(values.regionGeree),
  });
}
