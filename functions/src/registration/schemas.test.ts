import { registerCompanySchema, sendInviteSchema } from "./schemas";

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
