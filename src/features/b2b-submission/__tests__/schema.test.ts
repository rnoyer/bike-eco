import { describe, expect, test } from "@jest/globals";
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
