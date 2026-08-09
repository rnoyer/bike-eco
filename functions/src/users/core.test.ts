import type { CallerClaims } from "../errors";
import {
  deleteColleagueCore, deleteMyAccountCore, setColleagueAdminCore,
  type TargetUser, type UsersDeps,
} from "./core";

const admin: CallerClaims = { uid: "admin1", role: "b2b", status: "active", companyId: "comp_1" };
const member: CallerClaims = { uid: "mem1", role: "b2b", status: "active", companyId: "comp_1" };
const boAdmin: CallerClaims = { uid: "bo1", role: "backoffice", status: "active", companyId: null };

const user = (over: Partial<TargetUser> & { uid: string }): TargetUser => ({
  role: "b2b", companyId: "comp_1", isAdmin: false, ...over,
});

const USERS: Record<string, TargetUser> = {
  admin1: user({ uid: "admin1", isAdmin: true }),
  admin2: user({ uid: "admin2", isAdmin: true }),
  mem1: user({ uid: "mem1" }),
  mem2: user({ uid: "mem2" }),
  other: user({ uid: "other", companyId: "comp_2" }),
  bo1: user({ uid: "bo1", role: "backoffice", companyId: null, isAdmin: true }),
  bo2: user({ uid: "bo2", role: "backoffice", companyId: null }),
};

interface Calls { admins: { uid: string; isAdmin: boolean }[]; authDeleted: string[]; docsDeleted: string[] }

function fakeDeps(over: Partial<UsersDeps> = {}): UsersDeps & { calls: Calls } {
  const calls: Calls = { admins: [], authDeleted: [], docsDeleted: [] };
  return {
    calls,
    getUser: async (uid) => USERS[uid] ?? null,
    countAdmins: async () => 2,
    setAdmin: async (uid, isAdmin) => { calls.admins.push({ uid, isAdmin }); },
    deleteAuthUser: async (uid) => { calls.authDeleted.push(uid); },
    deleteUserDoc: async (uid) => { calls.docsDeleted.push(uid); },
    ...over,
  };
}

test("an admin promotes a colleague of their company", async () => {
  const d = fakeDeps();
  await setColleagueAdminCore({ uid: "mem1", isAdmin: true }, admin, d);
  expect(d.calls.admins).toEqual([{ uid: "mem1", isAdmin: true }]);
});

test("a non-admin cannot promote anyone", async () => {
  const d = fakeDeps();
  await expect(setColleagueAdminCore({ uid: "mem2", isAdmin: true }, member, d))
    .rejects.toMatchObject({ code: "permission-denied" });
});

test("an admin cannot touch a user of another company", async () => {
  const d = fakeDeps();
  await expect(setColleagueAdminCore({ uid: "other", isAdmin: true }, admin, d))
    .rejects.toMatchObject({ code: "not-found" });
});

test("a b2b admin cannot touch a back-office user", async () => {
  const d = fakeDeps();
  await expect(setColleagueAdminCore({ uid: "bo2", isAdmin: true }, admin, d))
    .rejects.toMatchObject({ code: "not-found" });
});

test("a back-office admin manages back-office users", async () => {
  const d = fakeDeps();
  await setColleagueAdminCore({ uid: "bo2", isAdmin: true }, boAdmin, d);
  expect(d.calls.admins).toEqual([{ uid: "bo2", isAdmin: true }]);
});

test("demoting the last admin is refused", async () => {
  const d = fakeDeps({ countAdmins: async () => 1 });
  await expect(setColleagueAdminCore({ uid: "admin1", isAdmin: false }, admin, d))
    .rejects.toMatchObject({ code: "failed-precondition" });
  expect(d.calls.admins).toEqual([]);
});

test("setting the flag it already has is a no-op", async () => {
  const d = fakeDeps();
  await setColleagueAdminCore({ uid: "mem1", isAdmin: false }, admin, d);
  expect(d.calls.admins).toEqual([]);
});

test("an admin deletes a colleague: auth user then profile doc, nothing else", async () => {
  const d = fakeDeps();
  await deleteColleagueCore({ uid: "mem1" }, admin, d);
  expect(d.calls.authDeleted).toEqual(["mem1"]);
  expect(d.calls.docsDeleted).toEqual(["mem1"]);
});

test("an admin colleague cannot be deleted", async () => {
  const d = fakeDeps();
  await expect(deleteColleagueCore({ uid: "admin2" }, admin, d))
    .rejects.toMatchObject({
      code: "failed-precondition",
      message: "Un administrateur ne peut pas être supprimé.",
    });
  expect(d.calls.authDeleted).toEqual([]);
});

test("the caller cannot delete themselves from the colleague screen", async () => {
  const d = fakeDeps();
  await expect(deleteColleagueCore({ uid: "admin1" }, admin, d))
    .rejects.toMatchObject({
      code: "failed-precondition",
      message: "Utilisez « Supprimer mon compte » pour votre propre compte.",
    });
  expect(d.calls.authDeleted).toEqual([]);
});

test("a non-admin cannot delete a colleague", async () => {
  const d = fakeDeps();
  await expect(deleteColleagueCore({ uid: "mem2" }, member, d))
    .rejects.toMatchObject({ code: "permission-denied" });
});

test("a non-admin deletes their own account", async () => {
  const d = fakeDeps();
  await deleteMyAccountCore(member, d);
  expect(d.calls.authDeleted).toEqual(["mem1"]);
  expect(d.calls.docsDeleted).toEqual(["mem1"]);
});

test("an admin cannot delete their own account", async () => {
  const d = fakeDeps();
  await expect(deleteMyAccountCore(admin, d))
    .rejects.toMatchObject({ code: "failed-precondition" });
  expect(d.calls.authDeleted).toEqual([]);
});

test("a pending colleague can still delete their own account", async () => {
  const d = fakeDeps();
  await deleteMyAccountCore({ ...member, status: "pending" }, d);
  expect(d.calls.authDeleted).toEqual(["mem1"]);
});

test("an inactive caller cannot manage colleagues", async () => {
  const d = fakeDeps();
  await expect(setColleagueAdminCore({ uid: "mem1", isAdmin: true }, { ...admin, status: "pending" }, d))
    .rejects.toMatchObject({ code: "permission-denied" });
});
