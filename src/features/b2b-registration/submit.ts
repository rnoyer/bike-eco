import { callRegisterCompany } from "@/lib/data/registration";
import type { B2bCompanyRegistrationForm } from "./schema";

/**
 * Password-path company registration: the Cloud Function creates the Firebase
 * Auth user, the `companies` doc (status "pending"), and the `users` doc
 * (status "pending", role/companyId set as server claims). The client is
 * intentionally NOT signed in afterwards — the applicant is pending and has
 * nothing to do until validated, so the confirmation screen is the endpoint
 * of this flow, not an active session. The Google path is handled directly
 * in `register.tsx` (the user is already signed in by the time step 2
 * completes, so `registerCompany` is called with `method: "google"` and no
 * password).
 */
export async function submitCompanyRegistration(
  values: B2bCompanyRegistrationForm
): Promise<void> {
  await callRegisterCompany({
    method: "password",
    siret: values.siret,
    companyName: values.companyName,
    companyDepartement: values.companyDepartement,
    nom: values.nom,
    prenom: values.prenom,
    telephone: values.telephone,
    departement: values.departement,
    ville: values.ville,
    email: values.email,
    password: values.password,
  });
}
