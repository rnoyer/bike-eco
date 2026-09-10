import type { CallerClaims } from "../errors";
import {
  chunk, deleteColleagueCore, deleteMyAccountCore, setColleagueAdminCore,
  updateMyProfileCore, type ProfilePatch, type TargetUser, type UsersDeps,
} from "./core";

const admin: CallerClaims = { uid: "admin1", role: "b2b", status: "active", companyId: "comp_1" };
const member: CallerClaims = { uid: "mem1", role: "b2b", status: "active", companyId: "comp_1" };
const boAdmin: CallerClaims = { uid: "bo1", role: "backoffice", status: "active", companyId: null };

const user = (over: Partial<TargetUser> & { uid: string }): TargetUser => ({
  role: "b2b", companyId: "comp_1", isAdmin: false,
  nom: "Noyer", prenom: "Romain", telephone: "0601020304", ...over,
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

interface Calls {
  admins: { uid: string; isAdmin: boolean }[];
  authDeleted: string[];
  docsDeleted: string[];
  profiles: { uid: string; patch: ProfilePatch }[];
  dossiers: { uid: string; patch: ProfilePatch }[];
  createdByNames: { companyId: string; name: string }[];
  cascaded: string[];
}

function fakeDeps(over: Partial<UsersDeps> = {}): UsersDeps & { calls: Calls } {
  const calls: Calls = {
    admins: [], authDeleted: [], docsDeleted: [],
    profiles: [], dossiers: [], createdByNames: [], cascaded: [],
  };
  return {
    calls,
    getUser: async (uid) => USERS[uid] ?? null,
    // Two admins and two vendeurs: nobody is the last of anything by default.
    listMembers: async () => [
      { uid: "admin1", isAdmin: true }, { uid: "admin2", isAdmin: true },
      { uid: "mem1", isAdmin: false }, { uid: "mem2", isAdmin: false },
    ],
    setAdmin: async (uid, isAdmin) => { calls.admins.push({ uid, isAdmin }); },
    deleteAuthUser: async (uid) => { calls.authDeleted.push(uid); },
    deleteUserDoc: async (uid) => { calls.docsDeleted.push(uid); },
    updateProfile: async (uid, patch) => { calls.profiles.push({ uid, patch }); },
    propagateToDossiers: async (uid, patch) => { calls.dossiers.push({ uid, patch }); },
    getCompanyCreator: async () => "admin1",
    setCompanyCreatedByName: async (companyId, name) => {
      calls.createdByNames.push({ companyId, name });
    },
    deleteCompanyCascade: async (companyId) => { calls.cascaded.push(companyId); },
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
  const d = fakeDeps({
    listMembers: async () => [
      { uid: "admin1", isAdmin: true }, { uid: "mem1", isAdmin: false },
    ],
  });
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

test("an admin with another admin left deletes their own account", async () => {
  const d = fakeDeps();
  await deleteMyAccountCore(admin, d);
  expect(d.calls.authDeleted).toEqual(["admin1"]);
  expect(d.calls.cascaded).toEqual([]);
});

test("the sole admin of a company that still has vendeurs is refused", async () => {
  const d = fakeDeps({
    listMembers: async () => [
      { uid: "admin1", isAdmin: true }, { uid: "mem1", isAdmin: false },
    ],
  });
  await expect(deleteMyAccountCore(admin, d)).rejects.toMatchObject({
    code: "failed-precondition",
    message: expect.stringContaining("dernier administrateur"),
  });
  expect(d.calls.authDeleted).toEqual([]);
  expect(d.calls.cascaded).toEqual([]);
});

test("the last member of a company takes the company with them", async () => {
  const d = fakeDeps({ listMembers: async () => [{ uid: "admin1", isAdmin: true }] });
  await deleteMyAccountCore(admin, d);
  expect(d.calls.cascaded).toEqual(["comp_1"]);
  // The cascade deletes every member, so no second self-delete runs.
  expect(d.calls.authDeleted).toEqual([]);
  expect(d.calls.docsDeleted).toEqual([]);
});

test("a lone non-admin also takes the company with them — no orphan is left", async () => {
  const d = fakeDeps({ listMembers: async () => [{ uid: "mem1", isAdmin: false }] });
  await deleteMyAccountCore(member, d);
  expect(d.calls.cascaded).toEqual(["comp_1"]);
});

const BO_TEAM = [
  { uid: "bo1", isAdmin: true }, { uid: "bo2", isAdmin: false },
];

test("a back-office member with an admin left deletes their own account", async () => {
  const d = fakeDeps({ listMembers: async () => BO_TEAM });
  await deleteMyAccountCore({ ...boAdmin, uid: "bo2" }, d);
  expect(d.calls.authDeleted).toEqual(["bo2"]);
});

test("a back-office admin with another admin left deletes their own account", async () => {
  const d = fakeDeps({
    listMembers: async () => [...BO_TEAM, { uid: "bo3", isAdmin: true }],
  });
  await deleteMyAccountCore(boAdmin, d);
  expect(d.calls.authDeleted).toEqual(["bo1"]);
});

test("the sole Bike-eco admin is refused while other members remain", async () => {
  const d = fakeDeps({ listMembers: async () => BO_TEAM });
  await expect(deleteMyAccountCore(boAdmin, d)).rejects.toMatchObject({
    code: "failed-precondition",
    message: expect.stringContaining("dernier administrateur de Bike-eco"),
  });
  expect(d.calls.authDeleted).toEqual([]);
});

// Bike-eco is the app, not a tenant: there is no cascade to run, and an empty
// team locks everyone out for good — `sendInvite` and `setColleagueAdmin` both
// need an admin caller, so nothing in the product could recover it.
test("the last Bike-eco member is refused, and nothing is cascaded", async () => {
  const d = fakeDeps({ listMembers: async () => [{ uid: "bo1", isAdmin: true }] });
  await expect(deleteMyAccountCore(boAdmin, d)).rejects.toMatchObject({
    code: "failed-precondition",
    message: expect.stringContaining("dernier membre de Bike-eco"),
  });
  expect(d.calls.authDeleted).toEqual([]);
  expect(d.calls.cascaded).toEqual([]);
});

test("a b2b account with no company deletes itself rather than being stranded", async () => {
  const d = fakeDeps({
    listMembers: async () => { throw new Error("no scope to query"); },
  });
  await deleteMyAccountCore({ ...member, companyId: null }, d);
  expect(d.calls.authDeleted).toEqual(["mem1"]);
  expect(d.calls.cascaded).toEqual([]);
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

// ─── updateMyProfile ─────────────────────────────────────────────────────────

test("updating a field writes the profile and every dossier that carries it", async () => {
  const d = fakeDeps();
  await updateMyProfileCore({ telephone: "0700000000" }, member, d);
  expect(d.calls.profiles).toEqual([{ uid: "mem1", patch: { telephone: "0700000000" } }]);
  expect(d.calls.dossiers).toEqual([{ uid: "mem1", patch: { telephone: "0700000000" } }]);
});

test("only the fields that actually differ are written", async () => {
  const d = fakeDeps();
  await updateMyProfileCore(
    { nom: "Noyer", prenom: "Romaine", telephone: "0601020304" },
    member,
    d,
  );
  expect(d.calls.profiles).toEqual([{ uid: "mem1", patch: { prenom: "Romaine" } }]);
});

test("resubmitting unchanged values writes nothing at all", async () => {
  const d = fakeDeps();
  await updateMyProfileCore({ nom: "Noyer", telephone: "0601020304" }, member, d);
  expect(d.calls.profiles).toEqual([]);
  expect(d.calls.dossiers).toEqual([]);
  expect(d.calls.createdByNames).toEqual([]);
});

test("the company creator's denormalized name follows a name change", async () => {
  const d = fakeDeps();
  await updateMyProfileCore({ prenom: "Romaine" }, admin, d);
  expect(d.calls.createdByNames).toEqual([{ companyId: "comp_1", name: "Romaine Noyer" }]);
});

test("a colleague who did not register the company leaves createdByName alone", async () => {
  const d = fakeDeps();
  await updateMyProfileCore({ prenom: "Romaine" }, member, d);
  expect(d.calls.createdByNames).toEqual([]);
});

test("a phone-only change never touches createdByName", async () => {
  const d = fakeDeps();
  await updateMyProfileCore({ telephone: "0700000000" }, admin, d);
  expect(d.calls.dossiers).toHaveLength(1);
  expect(d.calls.createdByNames).toEqual([]);
});

test("a back-office user has no company to propagate to", async () => {
  const d = fakeDeps();
  await updateMyProfileCore({ nom: "Dupont" }, boAdmin, d);
  expect(d.calls.profiles).toEqual([{ uid: "bo1", patch: { nom: "Dupont" } }]);
  expect(d.calls.createdByNames).toEqual([]);
});

test("a caller with no profile document is refused", async () => {
  const d = fakeDeps({ getUser: async () => null });
  await expect(updateMyProfileCore({ nom: "Dupont" }, member, d))
    .rejects.toMatchObject({ code: "not-found" });
});

test("chunk splits a list into batches and keeps the order", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(chunk([], 2)).toEqual([]);
});
