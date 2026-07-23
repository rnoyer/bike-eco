import { acceptInviteSchema, registerCompanySchema, resolveInviteSchema, sendInviteSchema } from "./schemas";

const base = {
  method: "password" as const,
  siret: "12345678901234",
  companyName: "Garage X",
  nom: "Durand",
  prenom: "Camille",
  telephone: "0600000000",
  departement: "75 - Paris",
  ville: "Paris",
  email: "c@x.fr",
  password: "password123",
};

test("password company registration requires email + password", () => {
  expect(registerCompanySchema.safeParse(base).success).toBe(true);
  const { email: _email, password: _password, ...noCreds } = base;
  expect(registerCompanySchema.safeParse({ ...noCreds }).success).toBe(false);
});

test("google company registration does not require email/password", () => {
  const { email: _email, password: _password, ...rest } = base;
  const parsed = registerCompanySchema.safeParse({ ...rest, method: "google" });
  expect(parsed.success).toBe(true);
});

test("siret must be exactly 14 digits", () => {
  expect(registerCompanySchema.safeParse({ ...base, siret: "123" }).success).toBe(false);
});

test("sendInvite needs a valid email", () => {
  expect(sendInviteSchema.safeParse({ email: "a@b.fr" }).success).toBe(true);
  expect(sendInviteSchema.safeParse({ email: "nope" }).success).toBe(false);
});

const acceptBase = {
  method: "password" as const,
  code: "A1B2C3",
  nom: "Durand",
  prenom: "Camille",
  telephone: "0600000000",
  departement: "75 - Paris",
  ville: "Paris",
  password: "password123",
};

test("acceptInvite password mode needs a password but NOT an email", () => {
  expect(acceptInviteSchema.safeParse(acceptBase).success).toBe(true);
  // email is never supplied by the client — a payload without it must still pass.
  expect("email" in acceptBase).toBe(false);
  const { password: _password, ...noPw } = acceptBase;
  expect(acceptInviteSchema.safeParse(noPw).success).toBe(false);
});

test("acceptInvite google mode needs neither email nor password", () => {
  const { password: _password, ...rest } = acceptBase;
  expect(acceptInviteSchema.safeParse({ ...rest, method: "google" }).success).toBe(true);
});

test("a malformed telephone is rejected", () => {
  expect(acceptInviteSchema.safeParse({ ...acceptBase, telephone: "06AB" }).success).toBe(false);
  expect(acceptInviteSchema.safeParse({ ...acceptBase, telephone: "060000000" }).success).toBe(false); // 9 digits
});

test("resolveInvite needs a non-empty code", () => {
  expect(resolveInviteSchema.safeParse({ code: "A1B2C3" }).success).toBe(true);
  expect(resolveInviteSchema.safeParse({ code: "" }).success).toBe(false);
});
