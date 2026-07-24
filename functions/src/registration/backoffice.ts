import { RegError, type CallerClaims } from "./core";

export interface BackofficeDeps {
  getCompany(id: string): Promise<{ name: string; status: string } | null>;
  getPendingCompanyUsers(companyId: string): Promise<{ uid: string; email: string }[]>;
  activateUser(uid: string): Promise<void>;
  setCompanyActive(id: string): Promise<void>;
  sendApprovalEmail(to: string, companyName: string): Promise<void>;
  deleteStorage(companyId: string): Promise<void>;
  deleteDossiers(companyId: string): Promise<void>;
  deleteUsers(companyId: string): Promise<void>;
  deleteCompany(id: string): Promise<void>;
}

function assertBackoffice(caller: CallerClaims): void {
  if (caller.role !== "backoffice" || caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée à l'équipe Bike-eco.");
  }
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
