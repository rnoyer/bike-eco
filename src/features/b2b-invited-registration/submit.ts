import type { B2bInvitedRegistrationForm } from "./schema";

/**
 * STUB (UI-only pass). Real implementation (later milestone): validate the
 * invitation token, create the Firebase Auth user, create the `users` doc with
 * the invited company's `companyId` and role set as server claims, and mark the
 * `invitations` doc accepted. For now we simulate latency so the funnel reaches
 * its confirmation screen.
 */
export async function submitInvitedRegistration(
  values: B2bInvitedRegistrationForm
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400));
  if (__DEV__) console.log("[stub] submitInvitedRegistration", values);
}
