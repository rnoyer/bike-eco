import { describe, expect, test } from "@jest/globals";
import { MAX_PHOTOS } from "@/constants/photos";
import {
  FREE_TEXT_MAX,
  IMMATRICULATION_MAX,
  SHORT_TEXT_MAX,
} from "@/constants/vehicle";
import {
  B2C_SUBMISSION_DEFAULTS,
  b2cSubmissionSchema,
} from "@/features/b2c-submission/schema";

describe("b2cSubmissionSchema — photos", () => {
  const valid = {
    ...B2C_SUBMISSION_DEFAULTS,
    nom: "Dupont",
    prenom: "Jean",
    email: "jean@example.com",
    telephone: "0612345678",
    departement: "59 - Nord",
    ville: "Lille",
    photos: ["file://a.jpg"],
  };

  const photos = (count: number) =>
    Array.from({ length: count }, (_, i) => `file://${i}.jpg`);

  test("accepts a submission with at least one photo", () => {
    expect(b2cSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects when there are no photos", () => {
    const r = b2cSubmissionSchema.safeParse({ ...valid, photos: [] });
    expect(r.success).toBe(false);
  });

  test("accepts exactly MAX_PHOTOS photos", () => {
    const r = b2cSubmissionSchema.safeParse({
      ...valid,
      photos: photos(MAX_PHOTOS),
    });
    expect(r.success).toBe(true);
  });

  test("rejects more than MAX_PHOTOS photos", () => {
    const r = b2cSubmissionSchema.safeParse({
      ...valid,
      photos: photos(MAX_PHOTOS + 1),
    });
    expect(r.success).toBe(false);
  });
});

describe("b2cSubmissionSchema — immatriculation", () => {
  const valid = {
    ...B2C_SUBMISSION_DEFAULTS,
    nom: "Dupont",
    prenom: "Jean",
    email: "jean@example.com",
    telephone: "0612345678",
    departement: "59 - Nord",
    ville: "Lille",
    photos: ["file://a.jpg"],
  };

  test("accepts a blank plate — the field is optional", () => {
    expect(
      b2cSubmissionSchema.safeParse({ ...valid, immatriculation: "" }).success,
    ).toBe(true);
  });

  test("accepts a plate of exactly IMMATRICULATION_MAX characters", () => {
    const r = b2cSubmissionSchema.safeParse({
      ...valid,
      immatriculation: "A".repeat(IMMATRICULATION_MAX),
    });
    expect(r.success).toBe(true);
  });

  test("rejects a plate longer than IMMATRICULATION_MAX characters", () => {
    const r = b2cSubmissionSchema.safeParse({
      ...valid,
      immatriculation: "A".repeat(IMMATRICULATION_MAX + 1),
    });
    expect(r.success).toBe(false);
  });
});

describe("b2cSubmissionSchema — caps and unasked checkboxes", () => {
  const valid = {
    ...B2C_SUBMISSION_DEFAULTS,
    nom: "Dupont",
    prenom: "Jean",
    email: "jean@example.com",
    telephone: "0612345678",
    departement: "59 - Nord",
    ville: "Lille",
    photos: ["file://a.jpg"],
  };

  test("caps free text at FREE_TEXT_MAX and single-line text at SHORT_TEXT_MAX", () => {
    expect(
      b2cSubmissionSchema.safeParse({
        ...valid,
        commentaires: "A".repeat(FREE_TEXT_MAX),
        marque: "A".repeat(SHORT_TEXT_MAX),
      }).success,
    ).toBe(true);
    expect(
      b2cSubmissionSchema.safeParse({
        ...valid,
        commentaires: "A".repeat(FREE_TEXT_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      b2cSubmissionSchema.safeParse({ ...valid, ville: "A".repeat(SHORT_TEXT_MAX + 1) })
        .success,
    ).toBe(false);
  });

  test("drops the checked boxes when the parent answer was flipped back", () => {
    const r = b2cSubmissionSchema.safeParse({
      ...valid,
      electrique: "non",
      materiel: ["J'ai la batterie"],
      aKeyless: "non",
      keyless: ["Code"],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.materiel).toEqual([]);
    expect(r.data.keyless).toEqual([]);
  });

  test("keeps them when their parent answer is oui", () => {
    const r = b2cSubmissionSchema.safeParse({
      ...valid,
      electrique: "oui",
      materiel: ["J'ai le chargeur"],
      aKeyless: "oui",
      keyless: ["Clé de secours"],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.materiel).toEqual(["J'ai le chargeur"]);
    expect(r.data.keyless).toEqual(["Clé de secours"]);
  });
});
