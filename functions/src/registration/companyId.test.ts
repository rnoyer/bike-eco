import { generateCompanyId } from "./companyId";

const SIRET = "12345678901234";

test("formats the id as <siret>-<6 alphanumerics>", () => {
  expect(generateCompanyId(SIRET)).toMatch(/^12345678901234-[A-Za-z0-9]{6}$/);
});

test("draws the suffix from the injected random source", () => {
  // 0 → first symbol of the alphabet, for all six draws.
  expect(generateCompanyId(SIRET, () => 0)).toBe(`${SIRET}-AAAAAA`);
});

test("a random source returning ~1 stays inside the alphabet", () => {
  // Math.random() is [0,1), but guard the clamp so a 1 can never index past the end.
  expect(generateCompanyId(SIRET, () => 0.999999999)).toBe(`${SIRET}-999999`);
  expect(generateCompanyId(SIRET, () => 1)).toBe(`${SIRET}-999999`);
});

test("suffixes differ across calls", () => {
  const ids = new Set(Array.from({ length: 50 }, () => generateCompanyId(SIRET)));
  expect(ids.size).toBeGreaterThan(45);
});
