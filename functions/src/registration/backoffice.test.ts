import { approveCompanyCore, type BackofficeDeps } from "./backoffice";
import type { CallerClaims } from "./core";

const boCaller: CallerClaims = { uid: "bo1", role: "backoffice", status: "active", companyId: null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeDeps(over: Partial<BackofficeDeps> = {}): BackofficeDeps & { calls: any } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any = { activated: [], emails: [], order: [] };
  return {
    calls,
    getCompany: async () => ({ name: "Garage X", status: "pending" }),
    getPendingCompanyUsers: async () => [{ uid: "owner1", email: "owner@x.fr" }],
    activateUser: async (uid) => { calls.activated.push(uid); calls.order.push(`activate:${uid}`); },
    setCompanyActive: async (id) => { calls.companyActive = id; calls.order.push(`company:${id}`); },
    sendApprovalEmail: async (to, name) => { calls.emails.push({ to, name }); },
    deleteStorage: async () => { throw new Error("must not be called"); },
    deleteDossiers: async () => { throw new Error("must not be called"); },
    deleteUsers: async () => { throw new Error("must not be called"); },
    deleteCompany: async () => { throw new Error("must not be called"); },
    ...over,
  };
}

test("approveCompany activates the owner + company and emails the applicant", async () => {
  const d = fakeDeps();
  await approveCompanyCore("comp_1", boCaller, d);
  expect(d.calls.activated).toEqual(["owner1"]);
  expect(d.calls.companyActive).toBe("comp_1");
  expect(d.calls.emails).toEqual([{ to: "owner@x.fr", name: "Garage X" }]);
});

test("approveCompany rejects a non-backoffice caller", async () => {
  const d = fakeDeps();
  await expect(
    approveCompanyCore("comp_1", { uid: "u", role: "b2b", status: "active", companyId: "c" }, d),
  ).rejects.toMatchObject({ code: "permission-denied" });
});

test("approveCompany rejects a company that is not pending", async () => {
  const d = fakeDeps({ getCompany: async () => ({ name: "Garage X", status: "active" }) });
  await expect(approveCompanyCore("comp_1", boCaller, d)).rejects.toMatchObject({ code: "failed-precondition" });
});

test("approveCompany rejects an unknown company", async () => {
  const d = fakeDeps({ getCompany: async () => null });
  await expect(approveCompanyCore("nope", boCaller, d)).rejects.toMatchObject({ code: "not-found" });
});
