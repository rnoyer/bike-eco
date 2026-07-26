import { expect, test } from "@jest/globals";
import { hasPasswordProvider } from "./passwordProvider";

test("an email/password account has a password credential", () => {
  expect(
    hasPasswordProvider({ providerData: [{ providerId: "password" }] }),
  ).toBe(true);
});

test("a Google-only account has none", () => {
  expect(
    hasPasswordProvider({ providerData: [{ providerId: "google.com" }] }),
  ).toBe(false);
});

test("an account linked to both still has one", () => {
  expect(
    hasPasswordProvider({
      providerData: [{ providerId: "google.com" }, { providerId: "password" }],
    }),
  ).toBe(true);
});

test("no user, or no providers at all, is false", () => {
  expect(hasPasswordProvider(null)).toBe(false);
  expect(hasPasswordProvider({ providerData: [] })).toBe(false);
});
