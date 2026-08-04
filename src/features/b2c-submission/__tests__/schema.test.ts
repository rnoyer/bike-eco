import { describe, expect, test } from "@jest/globals";
import { MAX_PHOTOS } from "@/constants/photos";
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
