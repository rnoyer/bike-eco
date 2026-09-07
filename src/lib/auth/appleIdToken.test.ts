import { expect, test } from "@jest/globals";
import { appleIdTokenEmail } from "./appleIdToken";

/** Build a JWT-shaped string whose payload is `claims`. Only the payload is
 *  read, so the header and signature are deliberately meaningless. */
function tokenWith(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

test("reads the email claim out of the payload", () => {
  expect(
    appleIdTokenEmail(tokenWith({ sub: "0001", email: "pro@garage.fr" })),
  ).toBe("pro@garage.fr");
});

test("reads a private-relay address like any other", () => {
  expect(
    appleIdTokenEmail(tokenWith({ email: "abc123@privaterelay.appleid.com" })),
  ).toBe("abc123@privaterelay.appleid.com");
});

test("a payload without an email claim yields null", () => {
  expect(appleIdTokenEmail(tokenWith({ sub: "0001" }))).toBeNull();
});

test("a non-string or empty email claim yields null", () => {
  expect(appleIdTokenEmail(tokenWith({ email: 42 }))).toBeNull();
  expect(appleIdTokenEmail(tokenWith({ email: "" }))).toBeNull();
});

test("a malformed or absent token yields null rather than throwing", () => {
  expect(appleIdTokenEmail(null)).toBeNull();
  expect(appleIdTokenEmail(undefined)).toBeNull();
  expect(appleIdTokenEmail("")).toBeNull();
  expect(appleIdTokenEmail("not-a-jwt")).toBeNull();
  expect(appleIdTokenEmail("header..signature")).toBeNull();
  expect(appleIdTokenEmail("header.%%%not-base64%%%.signature")).toBeNull();
});
