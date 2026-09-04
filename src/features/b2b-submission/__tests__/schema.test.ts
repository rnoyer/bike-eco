import { describe, expect, test } from "@jest/globals";
import { MAX_PHOTOS } from "@/constants/photos";
import {
  FREE_TEXT_MAX,
  IMMATRICULATION_MAX,
  SHORT_TEXT_MAX,
} from "@/constants/vehicle";
import {
  B2B_SUBMISSION_DEFAULTS,
  b2bSubmissionSchema,
} from "@/features/b2b-submission/schema";

describe("b2bSubmissionSchema", () => {
  const valid = {
    ...B2B_SUBMISSION_DEFAULTS,
    marque: "Honda",
    photos: ["file://a.jpg"],
  };

  test("accepts a vehicle with a marque and at least one photo", () => {
    expect(b2bSubmissionSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects when there are no photos", () => {
    const r = b2bSubmissionSchema.safeParse({ ...valid, photos: [] });
    expect(r.success).toBe(false);
  });

  test("rejects more than MAX_PHOTOS photos", () => {
    const photos = Array.from(
      { length: MAX_PHOTOS + 1 },
      (_, i) => `file://${i}.jpg`,
    );
    const r = b2bSubmissionSchema.safeParse({ ...valid, photos });
    expect(r.success).toBe(false);
  });

  test("accepts exactly MAX_PHOTOS photos", () => {
    const photos = Array.from(
      { length: MAX_PHOTOS },
      (_, i) => `file://${i}.jpg`,
    );
    expect(b2bSubmissionSchema.safeParse({ ...valid, photos }).success).toBe(
      true,
    );
  });

  test("accepts a plate of exactly IMMATRICULATION_MAX characters", () => {
    const r = b2bSubmissionSchema.safeParse({
      ...valid,
      immatriculation: "A".repeat(IMMATRICULATION_MAX),
    });
    expect(r.success).toBe(true);
  });

  test("rejects a plate longer than IMMATRICULATION_MAX characters", () => {
    const r = b2bSubmissionSchema.safeParse({
      ...valid,
      immatriculation: "A".repeat(IMMATRICULATION_MAX + 1),
    });
    expect(r.success).toBe(false);
  });

  test("rejects when both marque and modele are empty", () => {
    const r = b2bSubmissionSchema.safeParse({ ...valid, marque: "", modele: "" });
    expect(r.success).toBe(false);
  });

  test("accepts when only modele is filled (marque empty)", () => {
    const r = b2bSubmissionSchema.safeParse({
      ...valid,
      marque: "",
      modele: "CB500 500cc",
    });
    expect(r.success).toBe(true);
  });
});

describe("b2bSubmissionSchema — caps and unasked checkboxes", () => {
  const valid = {
    ...B2B_SUBMISSION_DEFAULTS,
    marque: "Honda",
    photos: ["file://a.jpg"],
  };

  test("caps free text at FREE_TEXT_MAX and single-line text at SHORT_TEXT_MAX", () => {
    expect(
      b2bSubmissionSchema.safeParse({
        ...valid,
        accessoires: "A".repeat(FREE_TEXT_MAX),
        modele: "A".repeat(SHORT_TEXT_MAX),
      }).success,
    ).toBe(true);
    expect(
      b2bSubmissionSchema.safeParse({
        ...valid,
        accessoires: "A".repeat(FREE_TEXT_MAX + 1),
      }).success,
    ).toBe(false);
    expect(
      b2bSubmissionSchema.safeParse({
        ...valid,
        modele: "A".repeat(SHORT_TEXT_MAX + 1),
      }).success,
    ).toBe(false);
  });

  test("keeps the checked boxes when their parent answer is oui", () => {
    const r = b2bSubmissionSchema.safeParse({
      ...valid,
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

  test("drops the checked boxes when the parent answer was flipped back", () => {
    // The funnel keeps the ticks in form state on purpose, so this is exactly
    // what a user who ticks a box then answers "non" leaves behind.
    const r = b2bSubmissionSchema.safeParse({
      ...valid,
      electrique: "non",
      materiel: ["J'ai la batterie"],
      aKeyless: "non",
      keyless: ["Code", "Clé de secours"],
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.materiel).toEqual([]);
    expect(r.data.keyless).toEqual([]);
  });
});
