import { describe, expect, test } from "@jest/globals";
import { normalizeTva, tvaIssue } from "@/lib/forms/tva";

const SIRET = "12345678901234"; // SIREN = 123456789

describe("normalizeTva", () => {
  test("uppercases and drops separators", () => {
    expect(normalizeTva("fr 1a-123 456 789")).toBe("FR1A123456789");
  });

  test("caps the length at 13 characters", () => {
    expect(normalizeTva("FR1A1234567890000")).toBe("FR1A123456789");
  });
});

describe("tvaIssue", () => {
  test("an empty value is accepted — the field is optional", () => {
    expect(tvaIssue("", SIRET)).toBeNull();
    expect(tvaIssue("   ", SIRET)).toBeNull();
  });

  test("accepts a digit key and a letter key", () => {
    expect(tvaIssue("FR12123456789", SIRET)).toBeNull();
    expect(tvaIssue("FR1A123456789", SIRET)).toBeNull();
    expect(tvaIssue("FRAB123456789", SIRET)).toBeNull();
  });

  test("accepts a lowercase / spaced entry", () => {
    expect(tvaIssue("fr 1a 123456789", SIRET)).toBeNull();
  });

  test("rejects a value that does not start with FR", () => {
    expect(tvaIssue("BE1A123456789", SIRET)).toBe(
      "Le numéro de TVA doit commencer par \"FR\"",
    );
    expect(tvaIssue("1A123456789", SIRET)).toBe(
      "Le numéro de TVA doit commencer par \"FR\"",
    );
  });

  test("rejects a value shorter or longer than 13 characters", () => {
    const message = "Ceci ne correspond pas à un numéro de TVA.";
    expect(tvaIssue("FR1A12345678", SIRET)).toBe(message);
    expect(tvaIssue("FR1A1234567891", SIRET)).toBe(message);
    expect(tvaIssue("FR", SIRET)).toBe(message);
  });

  test("rejects a SIREN part that is not 9 digits", () => {
    expect(tvaIssue("FR1A12345678A", SIRET)).toBe(
      "Ceci ne correspond pas à un numéro de TVA.",
    );
  });

  test("rejects a SIREN that does not match the SIRET", () => {
    expect(tvaIssue("FR1A987654321", SIRET)).toBe(
      "Le numéro de TVA et le numéro SIRET doivent correspondre",
    );
  });

  test("skips the SIRET comparison while the SIRET is itself invalid", () => {
    // The SIRET field shows its own error; a second one under TVA would be noise.
    expect(tvaIssue("FR1A123456789", "123")).toBeNull();
    expect(tvaIssue("FR1A123456789", "")).toBeNull();
  });
});
