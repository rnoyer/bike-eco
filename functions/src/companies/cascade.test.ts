import { deleteCompanyCascade, type CompanyCascadeDeps } from "./cascade";

function recordingDeps() {
  const order: string[] = [];
  const deps: CompanyCascadeDeps = {
    deleteStorage: async () => { order.push("storage"); },
    deleteDossiers: async () => { order.push("dossiers"); },
    deleteUsers: async () => { order.push("users"); },
    deleteInvitations: async () => { order.push("invitations"); },
    deleteCompany: async () => { order.push("company"); },
  };
  return { deps, order };
}

test("cascades storage → dossiers → users → invitations → company", async () => {
  const { deps, order } = recordingDeps();
  await deleteCompanyCascade("comp_1", deps);
  expect(order).toEqual(["storage", "dossiers", "users", "invitations", "company"]);
});

test("stops at the first failure, leaving no orphaned files behind it", async () => {
  const { deps, order } = recordingDeps();
  await expect(
    deleteCompanyCascade("comp_1", {
      ...deps,
      deleteDossiers: async () => { throw new Error("boom"); },
    }),
  ).rejects.toThrow("boom");
  // Storage ran, nothing after it did — the company doc still points at what is left.
  expect(order).toEqual(["storage"]);
});
