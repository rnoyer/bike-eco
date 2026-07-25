import { expect, test } from "@jest/globals";
import {
  emailsMatch,
  GoogleEmailMismatchError,
  googleEmailMismatchMessage,
} from "./googleEmail";

test("matching ignores case and surrounding whitespace", () => {
  expect(emailsMatch("Rom.Noy@Gmail.com", "rom.noy@gmail.com")).toBe(
    true,
  );
  expect(emailsMatch("  rom.noy@gmail.com  ", "rom.noy@gmail.com")).toBe(
    true,
  );
});

test("different addresses do not match", () => {
  expect(emailsMatch("rno.dev@gmail.com", "rom.noy@gmail.com")).toBe(
    false,
  );
});

test("a nullish or empty side never matches", () => {
  expect(emailsMatch(null, "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch(undefined, "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch("", "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch("rom.noy@gmail.com", null)).toBe(false);
  expect(emailsMatch(null, null)).toBe(false);
});

test("the message names both addresses so the user can pick the right account", () => {
  const msg = googleEmailMismatchMessage(
    "rno.dev@gmail.com",
    "rom.noy@gmail.com",
  );
  expect(msg).toContain("rno.dev@gmail.com");
  expect(msg).toContain("rom.noy@gmail.com");
});

test("the message stays readable when Google reports no email", () => {
  const msg = googleEmailMismatchMessage(null, "rom.noy@gmail.com");
  expect(msg).toContain("Le compte Google sélectionné");
  expect(msg).toContain("rom.noy@gmail.com");
});

test("the error carries both addresses and the French message", () => {
  const err = new GoogleEmailMismatchError(
    "rno.dev@gmail.com",
    "rom.noy@gmail.com",
  );
  expect(err).toBeInstanceOf(Error);
  expect(err.googleEmail).toBe("rno.dev@gmail.com");
  expect(err.expectedEmail).toBe("rom.noy@gmail.com");
  expect(err.message).toBe(
    googleEmailMismatchMessage("rno.dev@gmail.com", "rom.noy@gmail.com"),
  );
});
