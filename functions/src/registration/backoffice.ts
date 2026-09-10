import { deleteCompanyCascade, type CompanyCascadeDeps } from "../companies/cascade";
import { assertBackoffice, RegError, type CallerClaims } from "../errors";

export interface BackofficeDeps extends CompanyCascadeDeps {
  getCompany(id: string): Promise<{ name: string; status: string } | null>;
  getPendingCompanyUsers(companyId: string): Promise<{ uid: string; email: string }[]>;
  activateUser(uid: string): Promise<void>;
  setCompanyActive(id: string): Promise<void>;
  sendApprovalEmail(to: string, companyName: string): Promise<void>;
}

export async function approveCompanyCore(
  companyId: string,
  caller: CallerClaims,
  deps: BackofficeDeps,
): Promise<void> {
  assertBackoffice(caller);
  const company = await deps.getCompany(companyId);
  if (!company) throw new RegError("not-found", "Entreprise introuvable.");
  if (company.status !== "pending") {
    throw new RegError("failed-precondition", "Cette entreprise n'est pas en attente de validation.");
  }
  const users = await deps.getPendingCompanyUsers(companyId);
  for (const user of users) await deps.activateUser(user.uid);
  await deps.setCompanyActive(companyId);
  if (users.length > 0) await deps.sendApprovalEmail(users[0].email, company.name);
}

export async function deleteCompanyCore(
  companyId: string,
  caller: CallerClaims,
  deps: BackofficeDeps,
): Promise<void> {
  assertBackoffice(caller);
  // The order, and why it is that order, live in `companies/cascade.ts` — the
  // same cascade runs when a company's last member deletes their own account.
  await deleteCompanyCascade(companyId, deps);
}
