import { expect, test } from "@jest/globals";
import { isStaleTokenRefresh } from "./staleRegistration";

test("is not stale when the callback's uid is still the active registration", () => {
  expect(isStaleTokenRefresh("user-1", "user-1")).toBe(false);
});

test("is stale once the active registration has been torn down (signed out)", () => {
  expect(isStaleTokenRefresh(null, "user-1")).toBe(true);
});

test("is stale once a different uid has become the active registration (second sign-in on the same device)", () => {
  expect(isStaleTokenRefresh("user-2", "user-1")).toBe(true);
});
