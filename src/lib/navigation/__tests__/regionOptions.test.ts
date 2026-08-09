import { expect, test } from "@jest/globals";

import { REGION_OPTIONS, regionFromLabel } from "@/lib/navigation/regionOptions";

test("every dropdown label maps back to a region", () => {
  expect(REGION_OPTIONS.map((o) => regionFromLabel(o.label))).toEqual([
    "NORTH",
    "SOUTH",
    null, // "Toute la France"
  ]);
});

test("no pick reads as Toute la France", () => {
  // The invited-registration dropdown is optional, so `null` reaches this
  // helper on submit and must not become a région the member never chose.
  expect(regionFromLabel(null)).toBeNull();
  expect(regionFromLabel("Moitié Est")).toBeNull();
});
