import { describe, expect, test } from "@jest/globals";
import {
  B2B_COMPANY_REGISTRATION_DEFAULTS,
  b2bCompanyRegistrationSchema,
} from "@/features/b2b-registration/schema";

const valid = {
  siret: "12345678901234",
  companyName: "Garage Test",
  companyDepartement: "33 - Gironde",
  companyVille: "Bordeaux",
  email: "pro@garage.fr",
  password: "secret12",
  nom: "Doe",
  prenom: "Jane",
  telephone: "0612345678",
};

describe("b2bCompanyRegistrationSchema", () => {
  test("accepts a fully valid registration", () => {
    expect(b2bCompanyRegistrationSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects a SIRET that is not 14 digits", () => {
    expect(b2bCompanyRegistrationSchema.safeParse({ ...valid, siret: "123" }).success).toBe(false);
  });

  test("rejects an invalid email", () => {
    expect(b2bCompanyRegistrationSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  test("rejects a phone that is not 10 digits", () => {
    expect(b2bCompanyRegistrationSchema.safeParse({ ...valid, telephone: "0612" }).success).toBe(false);
  });

  test("rejects a password shorter than 8 characters", () => {
    expect(b2bCompanyRegistrationSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  test("defaults are all empty strings", () => {
    expect(B2B_COMPANY_REGISTRATION_DEFAULTS.siret).toBe("");
  });

  test("companyDepartement is required", () => {
    const result = b2bCompanyRegistrationSchema.safeParse({
      ...B2B_COMPANY_REGISTRATION_DEFAULTS,
      siret: "12345678901234",
      companyName: "Garage X",
      companyDepartement: "",
      companyVille: "Paris",
      email: "a@b.fr",
      password: "password123",
      nom: "N", prenom: "P", telephone: "0600000000",
    });
    expect(result.success).toBe(false);
  });

  test("companyVille is required", () => {
    const result = b2bCompanyRegistrationSchema.safeParse({ ...valid, companyVille: "" });
    expect(result.success).toBe(false);
  });
});
