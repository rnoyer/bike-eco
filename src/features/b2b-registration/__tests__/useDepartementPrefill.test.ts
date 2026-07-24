import { expect, test } from "@jest/globals";

import { nextDepartement } from "../useDepartementPrefill";

test("mirrors the company département into an empty user field", () => {
  expect(nextDepartement("33 - Gironde", "")).toBe("33 - Gironde");
});

test("re-syncs when the company département changes", () => {
  // The registrant went back to step 1 and picked a different département; the
  // disabled user field must follow, not stay stuck on the first value.
  expect(nextDepartement("75 - Paris", "33 - Gironde")).toBe("75 - Paris");
});

test("does nothing when there is no company département yet", () => {
  expect(nextDepartement("", "")).toBeNull();
});

test("does nothing when the user field is already in sync", () => {
  expect(nextDepartement("33 - Gironde", "33 - Gironde")).toBeNull();
});
