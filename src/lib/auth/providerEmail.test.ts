import { expect, test } from "@jest/globals";
import {
  emailsMatch,
  ProviderEmailMismatchError,
  providerEmailMismatchMessage,
} from "./providerEmail";

test("matching ignores case and surrounding whitespace", () => {
  expect(emailsMatch("Rom.Noy@Gmail.com", "rom.noy@gmail.com")).toBe(true);
  expect(emailsMatch("  rom.noy@gmail.com  ", "rom.noy@gmail.com")).toBe(true);
});

test("different addresses do not match", () => {
  expect(emailsMatch("rno.dev@gmail.com", "rom.noy@gmail.com")).toBe(false);
});

test("a nullish or empty side never matches", () => {
  expect(emailsMatch(null, "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch(undefined, "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch("", "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch("rom.noy@gmail.com", null)).toBe(false);
  expect(emailsMatch(null, null)).toBe(false);
});

test("the message names both addresses so the user can pick the right account", () => {
  const msg = providerEmailMismatchMessage(
    "google",
    "rno.dev@gmail.com",
    "rom.noy@gmail.com",
  );
  expect(msg).toContain("rno.dev@gmail.com");
  expect(msg).toContain("rom.noy@gmail.com");
});

test("the message names the provider that was used", () => {
  expect(
    providerEmailMismatchMessage("google", "a@x.fr", "b@x.fr"),
  ).toContain("Le compte Google a@x.fr");
  expect(
    providerEmailMismatchMessage("apple", "a@x.fr", "b@x.fr"),
  ).toContain("Le compte Apple a@x.fr");
});

test("the message stays readable when the provider reports no email", () => {
  expect(providerEmailMismatchMessage("google", null, "rom.noy@gmail.com")).toContain(
    "Le compte Google sélectionné",
  );
  expect(providerEmailMismatchMessage("apple", null, "rom.noy@gmail.com")).toContain(
    "Le compte Apple sélectionné",
  );
});

test("the error carries the provider, both addresses and the French message", () => {
  const err = new ProviderEmailMismatchError(
    "apple",
    "rno.dev@gmail.com",
    "rom.noy@gmail.com",
  );
  expect(err).toBeInstanceOf(Error);
  expect(err.provider).toBe("apple");
  expect(err.providerEmail).toBe("rno.dev@gmail.com");
  expect(err.expectedEmail).toBe("rom.noy@gmail.com");
  expect(err.message).toBe(
    providerEmailMismatchMessage("apple", "rno.dev@gmail.com", "rom.noy@gmail.com"),
  );
});
