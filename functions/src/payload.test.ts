import { describe, expect, test } from "@jest/globals";
import { b2cPayloadSchema } from "./payload";

/** The minimum a request must carry: everything else has a default. */
const valid = {
  nom: "Dupont",
  prenom: "Jean",
  email: "jean@example.com",
  telephone: "0612345678",
  departement: "59 - Nord",
  ville: "Lille",
};

const parse = (over: Record<string, unknown> = {}) =>
  b2cPayloadSchema.safeParse({ ...valid, ...over });

describe("b2cPayloadSchema — required coordonnées", () => {
  test("accepts a minimal payload and defaults the rest", () => {
    const r = parse();
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.electrique).toBe("non");
    expect(r.data.materiel).toEqual([]);
    expect(r.data.keyless).toEqual([]);
    expect(r.data.immatriculation).toBe("");
    expect(r.data.aClesContact).toBeNull();
  });

  test("rejects a malformed email and a phone that is not 10 digits", () => {
    expect(parse({ email: "nope" }).success).toBe(false);
    expect(parse({ telephone: "061234567" }).success).toBe(false);
  });
});

// This endpoint is public and unauthenticated, so every string is bounded —
// otherwise a single oversized field is inlined verbatim into both emails.
describe("b2cPayloadSchema — length caps", () => {
  test.each([
    ["marque", 120],
    ["modele", 120],
    ["naturePanne", 120],
    ["nom", 120],
    ["ville", 120],
    ["accessoires", 2000],
    ["commentaires", 2000],
    ["kilometrage", 9],
    ["prix", 9],
    ["immatriculation", 15],
  ])("%s accepts %i characters and rejects one more", (field, max) => {
    expect(parse({ [field]: "A".repeat(max) }).success).toBe(true);
    expect(parse({ [field]: "A".repeat(max + 1) }).success).toBe(false);
  });

  test("caps a dropdown answer and a checkbox label", () => {
    expect(parse({ modalite: "A".repeat(80) }).success).toBe(true);
    expect(parse({ modalite: "A".repeat(81) }).success).toBe(false);
    expect(parse({ materiel: ["A".repeat(81)] }).success).toBe(false);
  });

  test("caps how many boxes a checkbox group may report", () => {
    const many = Array.from({ length: 11 }, (_, i) => `item ${i}`);
    expect(parse({ electrique: "oui", materiel: many }).success).toBe(false);
  });
});

describe("b2cPayloadSchema — unasked checkboxes", () => {
  test("keeps the checked labels when the parent answer is oui", () => {
    const r = parse({
      electrique: "oui",
      materiel: ["J'ai la batterie"],
      aKeyless: "oui",
      keyless: ["Code"],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.materiel).toEqual(["J'ai la batterie"]);
    expect(r.data.keyless).toEqual(["Code"]);
  });

  test("drops them when the parent answer is not oui", () => {
    // A client that trusts its own form state can send this after the user
    // ticks a box and then flips the dropdown back — the endpoint is public,
    // so it re-derives the rule rather than taking the payload's word for it.
    const r = parse({
      electrique: "non",
      materiel: ["J'ai la batterie"],
      aKeyless: null,
      keyless: ["Code", "Clé de secours"],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.materiel).toEqual([]);
    expect(r.data.keyless).toEqual([]);
  });
});
