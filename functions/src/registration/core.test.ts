import {
  acceptInviteCore,
  registerCompanyCore,
  resolveInviteCore,
  sendInviteCore,
  type Deps,
} from "./core";
import { hashInviteCode } from "./inviteCode";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeDeps(over: Partial<Deps> = {}): Deps & { calls: any } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any = { companies: {}, users: {}, invitations: {}, emails: [] };
  return {
    calls,
    createUser: async () => "uid_new",
    setClaims: async (uid, claims) => { calls.claims = { uid, claims }; },
    companyExistsForSiret: async () => false,
    writeCompany: async (id, data) => { calls.companies[id] = data; },
    writeUser: async (uid, data) => { calls.users[uid] = data; },
    newCompanyId: (siret) => `${siret}-aaaaaa`,
    newDocumentId: () => "doc_new",
    findInvitationByHash: async () => null,
    deleteInvitation: async (id) => { calls.invitations[id] = "deleted"; },
    writeInvitation: async (id, data) => { calls.invitations[id] = data; },
    now: () => 1_000_000,
    sendApplicantEmail: async (to, name) => { calls.emails.push({ kind: "applicant", to, name }); },
    getUserIsAdmin: async () => true,
    getCompanyName: async () => "Garage X",
    sendInviteEmail: async (to, code, organisationName) => {
      calls.emails.push({ kind: "invite", to, code, organisationName });
    },
    ...over,
  };
}

const companyInput = {
  method: "password" as const, siret: "12345678901234", companyName: "Garage X",
  companyDepartement: "75 - Paris", companyVille: "Paris",
  nom: "Durand", prenom: "Camille", telephone: "0600000000",
  email: "c@x.fr", password: "password123",
};

test("registerCompany (password) creates pending company+user, pins claims, emails applicant", async () => {
  const d = fakeDeps();
  await registerCompanyCore(companyInput, null, null, d);
  expect(d.calls.companies["12345678901234-aaaaaa"]).toMatchObject({
    siret: "12345678901234",
    status: "pending",
    createdBy: "uid_new",
    departement: "75 - Paris",
    ville: "Paris",
    region: "NORTH",
    createdByName: "Camille Durand",
    validatedAt: null,
  });
  const companyId = "12345678901234-aaaaaa";
  expect(d.calls.users["uid_new"]).toMatchObject({ role: "b2b", companyId, status: "pending" });
  expect(d.calls.claims).toEqual({ uid: "uid_new", claims: { role: "b2b", companyId, status: "pending" } });
  expect(d.calls.emails).toEqual([{ kind: "applicant", to: "c@x.fr", name: "Garage X" }]);
});

test("registerCompany stores the TVA number, or null when it was not given", async () => {
  const withTva = fakeDeps();
  await registerCompanyCore({ ...companyInput, tva: "FR1A123456789" }, null, null, withTva);
  expect(withTva.calls.companies["12345678901234-aaaaaa"].tva).toBe("FR1A123456789");

  const without = fakeDeps();
  await registerCompanyCore(companyInput, null, null, without);
  expect(without.calls.companies["12345678901234-aaaaaa"].tva).toBeNull();
});

test("registerCompany rejects a duplicate SIRET", async () => {
  const d = fakeDeps({ companyExistsForSiret: async () => true });
  await expect(registerCompanyCore(companyInput, null, null, d)).rejects.toMatchObject({ code: "already-exists" });
});

test("registerCompany (google) uses the authed uid + email, no createUser", async () => {
  const { email: _email, password: _password, ...rest } = companyInput;
  const d = fakeDeps({ createUser: async () => { throw new Error("must not be called"); } });
  await registerCompanyCore({ ...rest, method: "google" }, "uid_g", "g@x.fr", d);
  expect(d.calls.users["uid_g"]).toBeDefined();
  expect(d.calls.claims.uid).toBe("uid_g");
});

test("sendInvite writes a hashed, 1h invitation for an active b2b caller", async () => {
  const d = fakeDeps();
  await sendInviteCore({ email: "new@x.fr" }, { role: "b2b", status: "active", companyId: "comp_1", uid: "u1" }, d);
  const [id] = Object.keys(d.calls.invitations);
  expect(d.calls.invitations[id]).toMatchObject({ email: "new@x.fr", role: "b2b", companyId: "comp_1", invitedBy: "u1", status: "pending", expiresAt: 1_000_000 + 3_600_000 });
  expect(d.calls.invitations[id].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  expect(d.calls.emails[0]).toMatchObject({ kind: "invite", to: "new@x.fr", organisationName: "Garage X" });
});

test("sendInvite refuses a non-active caller", async () => {
  const d = fakeDeps();
  await expect(sendInviteCore({ email: "x@x.fr" }, { role: "b2b", status: "pending", companyId: "c", uid: "u" }, d)).rejects.toMatchObject({ code: "permission-denied" });
});

test("resolveInvite returns the email for a valid code and deletes an expired one", async () => {
  const good = { id: "inv1", email: "new@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "Garage X", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  const d = fakeDeps({ findInvitationByHash: async (h) => (h === good.tokenHash ? good : null) });
  await expect(resolveInviteCore({ code: "a1b2c3" }, d)).resolves.toEqual({ email: "new@x.fr", role: "b2b", organisationName: "Garage X" });

  const expired = { ...good, expiresAt: 500_000 };
  const d2 = fakeDeps({ findInvitationByHash: async () => expired });
  await expect(resolveInviteCore({ code: "A1B2C3" }, d2)).rejects.toMatchObject({ code: "not-found" });
  expect(d2.calls.invitations["inv1"]).toBe("deleted");
});

test("resolveInvite names Bike-eco for a back-office invitation", async () => {
  const inv = {
    id: "inv2", email: "team@bike-eco.fr", role: "backoffice" as const, companyId: null,
    companyName: null, tokenHash: hashInviteCode("Z9Y8X7"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await expect(resolveInviteCore({ code: "Z9Y8X7" }, d)).resolves.toEqual({
    email: "team@bike-eco.fr", role: "backoffice", organisationName: "Bike-eco",
  });
});

test("acceptInvite creates an ACTIVE user in the invitation's company and deletes the invite", async () => {
  const inv = { id: "inv1", email: "new@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "G", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore({ method: "password", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000", password: "password123" }, null, null, d);
  expect(d.calls.users["uid_new"]).toMatchObject({ role: "b2b", companyId: "comp_1", status: "active" });
  expect(d.calls.claims.claims.status).toBe("active");
  expect(d.calls.invitations["inv1"]).toBe("deleted");
});

test("acceptInvite (google) requires the Google email to match the invitation", async () => {
  const inv = { id: "inv1", email: "new@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "G", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await expect(acceptInviteCore({ method: "google", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000" }, "uid_g", "other@x.fr", d)).rejects.toMatchObject({ code: "permission-denied" });
});

test("acceptInvite (google) with a matching email skips createUser and creates an active user", async () => {
  const inv = { id: "inv1", email: "New@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "G", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  // createUser throws so a regression that called it in google mode would fail here.
  const d = fakeDeps({ findInvitationByHash: async () => inv, createUser: async () => { throw new Error("must not be called"); } });
  await acceptInviteCore({ method: "google", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000" }, "uid_g", "new@x.fr", d);
  expect(d.calls.users["uid_g"]).toMatchObject({ role: "b2b", companyId: "comp_1", status: "active" });
  expect(d.calls.claims).toEqual({ uid: "uid_g", claims: { role: "b2b", companyId: "comp_1", status: "active" } });
  expect(d.calls.invitations["inv1"]).toBe("deleted");
});

test("google mode with no auth is rejected as unauthenticated (both flows)", async () => {
  const { email: _email, password: _password, ...companyRest } = companyInput;
  await expect(
    registerCompanyCore({ ...companyRest, method: "google" }, null, null, fakeDeps()),
  ).rejects.toMatchObject({ code: "unauthenticated" });

  const inv = { id: "inv1", email: "n@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "G", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  await expect(
    acceptInviteCore({ method: "google", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000" }, null, null, fakeDeps({ findInvitationByHash: async () => inv })),
  ).rejects.toMatchObject({ code: "unauthenticated" });
});

test("a duplicate SIRET is rejected BEFORE any user/company is created", async () => {
  const d = fakeDeps({ companyExistsForSiret: async () => true, createUser: async () => { throw new Error("must not be called"); } });
  await expect(registerCompanyCore(companyInput, null, null, d)).rejects.toMatchObject({ code: "already-exists" });
  expect(d.calls.companies).toEqual({});
  expect(d.calls.users).toEqual({});
});

test("registerCompany makes the registrant an admin", async () => {
  const d = fakeDeps();
  await registerCompanyCore(companyInput, null, null, d);
  expect(d.calls.users["uid_new"].isAdmin).toBe(true);
});

test("acceptInvite creates a non-admin colleague", async () => {
  const inv = {
    id: "inv1", email: "new@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "G",
    tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore(
    { method: "password", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000", password: "password123" },
    null, null, d,
  );
  expect(d.calls.users["uid_new"].isAdmin).toBe(false);
});

test("acceptInvite stores the back-office invitee's région gérée", async () => {
  const inv = {
    id: "inv2", email: "team@bike-eco.fr", role: "backoffice" as const, companyId: null,
    companyName: null, tokenHash: hashInviteCode("Z9Y8X7"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore(
    { method: "password", code: "Z9Y8X7", nom: "N", prenom: "P", telephone: "0600000000", password: "password123", notificationRegion: "SOUTH" },
    null, null, d,
  );
  expect(d.calls.users["uid_new"]).toMatchObject({ role: "backoffice", notificationRegion: "SOUTH" });
});

test("a back-office invitee who picks nothing gets an explicit null (Toute la France)", async () => {
  const inv = {
    id: "inv2", email: "team@bike-eco.fr", role: "backoffice" as const, companyId: null,
    companyName: null, tokenHash: hashInviteCode("Z9Y8X7"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore(
    { method: "password", code: "Z9Y8X7", nom: "N", prenom: "P", telephone: "0600000000", password: "password123" },
    null, null, d,
  );
  expect(d.calls.users["uid_new"].notificationRegion).toBeNull();
});

test("a b2b invitee never gets a notificationRegion, even if the payload carries one", async () => {
  const inv = {
    id: "inv1", email: "new@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "G",
    tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore(
    { method: "password", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000", password: "password123", notificationRegion: "NORTH" },
    null, null, d,
  );
  expect(d.calls.users["uid_new"]).not.toHaveProperty("notificationRegion");
});

test("sendInvite refuses a non-admin caller, before writing or emailing anything", async () => {
  const d = fakeDeps({ getUserIsAdmin: async () => false });
  await expect(
    sendInviteCore({ email: "x@x.fr" }, { role: "b2b", status: "active", companyId: "comp_1", uid: "u1" }, d),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(d.calls.invitations).toEqual({});
  expect(d.calls.emails).toEqual([]);
});

test("sendInvite from a back-office admin writes a company-less back-office invitation", async () => {
  const d = fakeDeps({
    getCompanyName: async () => { throw new Error("must not be called"); },
  });
  await sendInviteCore({ email: "team@bike-eco.fr" }, { role: "backoffice", status: "active", companyId: null, uid: "bo1" }, d);
  const [id] = Object.keys(d.calls.invitations);
  expect(d.calls.invitations[id]).toMatchObject({
    email: "team@bike-eco.fr", role: "backoffice", companyId: null, invitedBy: "bo1", status: "pending",
  });
  expect(d.calls.emails[0]).toMatchObject({ kind: "invite", to: "team@bike-eco.fr", organisationName: "Bike-eco" });
});

test("sendInvite refuses a non-admin back-office caller", async () => {
  const d = fakeDeps({ getUserIsAdmin: async () => false });
  await expect(
    sendInviteCore({ email: "x@x.fr" }, { role: "backoffice", status: "active", companyId: null, uid: "bo1" }, d),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(d.calls.invitations).toEqual({});
});

test("acceptInvite on a back-office invitation creates an active, non-admin team member", async () => {
  const inv = {
    id: "inv2", email: "team@bike-eco.fr", role: "backoffice" as const, companyId: null,
    companyName: null, tokenHash: hashInviteCode("Z9Y8X7"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore(
    { method: "password", code: "Z9Y8X7", nom: "N", prenom: "P", telephone: "0600000000", password: "password123" },
    null, null, d,
  );
  expect(d.calls.users["uid_new"]).toMatchObject({
    role: "backoffice", companyId: null, status: "active", isAdmin: false,
    nom: "N", prenom: "P", email: "team@bike-eco.fr", telephone: "0600000000",
  });
  expect(d.calls.claims).toEqual({
    uid: "uid_new", claims: { role: "backoffice", companyId: null, status: "active" },
  });
  expect(d.calls.invitations["inv2"]).toBe("deleted");
});
