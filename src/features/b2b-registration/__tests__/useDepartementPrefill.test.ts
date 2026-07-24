import { expect, test } from "@jest/globals";

import { nextDepartement } from "../useDepartementPrefill";

test("pre-fills an empty user département from the company département", () => {
  expect(nextDepartement("33 - Gironde", "", false)).toBe("33 - Gironde");
});

test("re-syncs when the company département changes and the user has not edited theirs", () => {
  // The registrant went back to step 1 and picked a different département; their
  // own field still holds the previously auto-filled value (never hand-edited).
  expect(nextDepartement("75 - Paris", "33 - Gironde", false)).toBe("75 - Paris");
});

test("keeps the user's own département once they have edited it", () => {
  expect(nextDepartement("75 - Paris", "13 - Bouches-du-Rhône", true)).toBeNull();
});

test("does nothing when there is no company département yet", () => {
  expect(nextDepartement("", "", false)).toBeNull();
});

test("does nothing when the user field is already in sync", () => {
  expect(nextDepartement("33 - Gironde", "33 - Gironde", false)).toBeNull();
});
