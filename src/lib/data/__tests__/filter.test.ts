import { test, expect } from "@jest/globals";

import { MOCK_DOSSIERS } from "@/lib/data/fixtures";
import { filterDossiersByRegion, selectByStatus } from "@/lib/data/filter";

test("selectByStatus keeps only requested statuses", () => {
  const out = selectByStatus(MOCK_DOSSIERS, ["a_traiter"]);
  expect(out.length).toBeGreaterThan(0);
  expect(out.every((d) => d.status === "a_traiter")).toBe(true);
});

test("filterDossiersByRegion null returns all", () => {
  expect(filterDossiersByRegion(MOCK_DOSSIERS, null)).toHaveLength(
    MOCK_DOSSIERS.length
  );
});

test("filterDossiersByRegion NORTH keeps only NORTH", () => {
  const out = filterDossiersByRegion(MOCK_DOSSIERS, "NORTH");
  expect(out.length).toBeGreaterThan(0);
  expect(out.every((d) => d.region === "NORTH")).toBe(true);
});
