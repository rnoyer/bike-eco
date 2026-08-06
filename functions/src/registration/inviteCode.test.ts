import {
  generateInviteCode,
  hashInviteCode,
  normalizeInviteCode,
} from "./inviteCode";

test("generateInviteCode is 6 uppercase alphanumerics", () => {
  for (let i = 0; i < 50; i++) {
    expect(generateInviteCode()).toMatch(/^[A-Z0-9]{6}$/);
  }
});

test("generateInviteCode maps the picked index deterministically", () => {
  // pickIndex always returning 0 -> first symbol 'A'; always the last index -> '9'.
  expect(generateInviteCode(() => 0)).toBe("AAAAAA");
  expect(generateInviteCode(() => 35)).toBe("999999");
});

test("normalizeInviteCode trims and uppercases", () => {
  expect(normalizeInviteCode("  a1b2c3 ")).toBe("A1B2C3");
});

test("hashInviteCode is stable, hex, and case-insensitive on input", () => {
  const h = hashInviteCode("A1B2C3");
  expect(h).toMatch(/^[0-9a-f]{64}$/);
  expect(hashInviteCode("a1b2c3")).toBe(h);
});
