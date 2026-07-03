import type { B2bCompanyRegistrationForm } from "./schema";

/**
 * STUB (UI-only pass). Real implementation (later milestone): call a Cloud
 * Function that creates the Firebase Auth user, the `companies` doc (status
 * "pending"), and the `users` doc (status "pending", role/companyId set as
 * server claims), then emails the applicant once the team validates. For now we
 * just simulate latency so the funnel reaches its confirmation screen.
 */
export async function submitCompanyRegistration(
  values: B2bCompanyRegistrationForm
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (__DEV__) console.log("[stub] submitCompanyRegistration", values);
}
