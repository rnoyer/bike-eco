import { describe, expect, test } from "@jest/globals";
import {
  B2B_COMPANY_REGISTRATION_DEFAULTS,
  b2bCompanyRegistrationSchema,
} from "@/features/b2b-registration/schema";

const valid = {
  siret: "12345678901234",
  tva: "",
  companyName: "Garage Test",
  companyDepartement: "33 - Gironde",
  companyVille: "Bordeaux",
  email: "pro@garage.fr",
  password: "secret12",
  confirmPassword: "secret12",
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
    expect(b2bCompanyRegistrationSchema.safeParse({ ...valid, password: "short", confirmPassword: "short" }).success).toBe(false);
  });

  test("rejects a confirmation that does not match the password", () => {
    const result = b2bCompanyRegistrationSchema.safeParse({ ...valid, confirmPassword: "secret13" });
    expect(result.success).toBe(false);
  });

  test("reports the mismatch on confirmPassword, not password", () => {
    const result = b2bCompanyRegistrationSchema.safeParse({ ...valid, confirmPassword: "secret13" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("confirmPassword");
    expect(paths).not.toContain("password");
  });

  test("catches the mismatch while later-step fields are still empty", () => {
    // The account step is validated mid-funnel, when nom/prenom/telephone are
    // still blank. The cross-field check must fire anyway, or "Suivant" would
    // advance past a mismatch.
    const result = b2bCompanyRegistrationSchema.safeParse({
      ...valid,
      confirmPassword: "secret13",
      nom: "",
      prenom: "",
      telephone: "",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path.join("."))).toContain("confirmPassword");
  });

  test("accepts a matching confirmation", () => {
    expect(
      b2bCompanyRegistrationSchema.safeParse({ ...valid, password: "hunter2000", confirmPassword: "hunter2000" }).success,
    ).toBe(true);
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
      confirmPassword: "password123",
      nom: "N", prenom: "P", telephone: "0600000000",
    });
    expect(result.success).toBe(false);
  });

  test("an empty TVA number is accepted — the field is optional", () => {
    expect(b2bCompanyRegistrationSchema.safeParse({ ...valid, tva: "" }).success).toBe(true);
  });

  test("accepts a TVA number matching the SIRET's SIREN", () => {
    expect(
      b2bCompanyRegistrationSchema.safeParse({ ...valid, tva: "FR1A123456789" }).success,
    ).toBe(true);
  });

  test("rejects a TVA number whose SIREN differs from the SIRET", () => {
    const result = b2bCompanyRegistrationSchema.safeParse({ ...valid, tva: "FR1A987654321" });
    expect(result.success).toBe(false);
    const issue = result.error!.issues.find((i) => i.path.join(".") === "tva");
    expect(issue?.message).toBe("Le numéro de TVA et le numéro SIRET doivent correspondre");
  });

  test("reports a malformed TVA number on the tva field", () => {
    const result = b2bCompanyRegistrationSchema.safeParse({ ...valid, tva: "BE1A123456789" });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path.join("."))).toContain("tva");
  });

  test("companyVille is required", () => {
    const result = b2bCompanyRegistrationSchema.safeParse({ ...valid, companyVille: "" });
    expect(result.success).toBe(false);
  });
});
