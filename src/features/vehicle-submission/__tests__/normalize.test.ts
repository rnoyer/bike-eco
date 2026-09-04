import { zodResolver } from "@hookform/resolvers/zod";
import { describe, expect, jest, test } from "@jest/globals";
import { createFormControl } from "react-hook-form";

import {
  B2B_SUBMISSION_DEFAULTS,
  b2bSubmissionSchema,
} from "@/features/b2b-submission/schema";
import { clearUnaskedCheckboxes } from "@/features/vehicle-submission/normalize";

describe("clearUnaskedCheckboxes", () => {
  const base = {
    electrique: "non",
    materiel: [] as string[],
    aKeyless: null as string | null,
    keyless: [] as string[],
  };

  test("keeps each group when its own parent answer is oui", () => {
    expect(
      clearUnaskedCheckboxes({
        ...base,
        electrique: "oui",
        materiel: ["J'ai la batterie"],
        aKeyless: "oui",
        keyless: ["Code"],
      }),
    ).toMatchObject({
      materiel: ["J'ai la batterie"],
      keyless: ["Code"],
    });
  });

  test("clears the groups independently", () => {
    // Électrique answered, keyless not: only the keyless boxes go.
    expect(
      clearUnaskedCheckboxes({
        ...base,
        electrique: "oui",
        materiel: ["J'ai le chargeur"],
        aKeyless: "non",
        keyless: ["Code"],
      }),
    ).toMatchObject({ materiel: ["J'ai le chargeur"], keyless: [] });
  });

  test("passes the rest of the object through untouched", () => {
    const out = clearUnaskedCheckboxes({ ...base, marque: "Yamaha" });
    expect(out.marque).toBe("Yamaha");
  });
});

/**
 * The normalisation is a schema `.transform()`, so it must clean the *submitted*
 * values without touching form state — that split is the whole design (the user
 * keeps their ticks when they flip a parent answer back and forth; only what
 * leaves the funnel is cleaned).
 *
 * Driven through `createFormControl` — the same react-hook-form instance
 * `useStepForm` builds, minus the React tree — because the split depends on how
 * react-hook-form treats a resolver that returns transformed values, which is
 * exactly the assumption an RHF upgrade could silently break.
 */
describe("the transform through react-hook-form", () => {
  const form = () =>
    createFormControl({
      resolver: zodResolver(b2bSubmissionSchema as never),
      mode: "onBlur",
      defaultValues: {
        ...B2B_SUBMISSION_DEFAULTS,
        marque: "Yamaha",
        photos: ["file://a.jpg"],
        // What a user leaves behind by ticking a box, then answering "non".
        electrique: "non",
        materiel: ["J'ai la batterie"],
        aKeyless: "non",
        keyless: ["Code"],
      },
    });

  test("a per-step trigger leaves the user's ticks in place", async () => {
    const f = form();
    await f.trigger(["aClesContact", "aKeyless", "keyless"]);
    expect(f.getValues("materiel")).toEqual(["J'ai la batterie"]);
    expect(f.getValues("keyless")).toEqual(["Code"]);
  });

  test("submitting hands the callback the cleared arrays", async () => {
    const f = form();
    const onSubmit = jest.fn();
    await f.handleSubmit(onSubmit)();
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const values = (onSubmit.mock.calls[0] as unknown[])[0] as {
      materiel: string[];
      keyless: string[];
      marque: string;
    };
    expect(values.materiel).toEqual([]);
    expect(values.keyless).toEqual([]);
    expect(values.marque).toBe("Yamaha");
    // …and form state is still what the user typed.
    expect(f.getValues("keyless")).toEqual(["Code"]);
  });
});
