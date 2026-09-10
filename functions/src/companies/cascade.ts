/**
 * Erasing a company and everything hanging off it.
 *
 * Its own module because two callables need the exact same cascade in the exact
 * same order: the back office's "Supprimer l'entreprise", and a b2b member
 * deleting their own account when they are the last one left (`deleteMyAccount`).
 * The ordering below is load-bearing, and duplicating it would let the two
 * drift.
 */

/** The five deletes the cascade is made of, injected so it stays testable. */
export interface CompanyCascadeDeps {
  deleteStorage(companyId: string): Promise<void>;
  deleteDossiers(companyId: string): Promise<void>;
  deleteUsers(companyId: string): Promise<void>;
  deleteInvitations(companyId: string): Promise<void>;
  deleteCompany(id: string): Promise<void>;
}

/**
 * Storage first: even if a later step fails, we never leave orphaned files that
 * no Firestore doc points at. Storage is company-prefixed
 * (`dossiers/{companyId}/...`), so one prefixed delete covers every photo,
 * thumbnail, and message attachment. Invitations are removed before the company
 * doc so an outstanding invite can never outlive the company it points at
 * (which would let acceptInvite create a user against a ghost company).
 */
export async function deleteCompanyCascade(
  companyId: string,
  deps: CompanyCascadeDeps,
): Promise<void> {
  await deps.deleteStorage(companyId);
  await deps.deleteDossiers(companyId);
  await deps.deleteUsers(companyId);
  await deps.deleteInvitations(companyId);
  await deps.deleteCompany(companyId);
}
