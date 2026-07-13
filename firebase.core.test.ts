import { expect, test } from "@jest/globals";
import { emulatorHost } from "./firebase.core";

test("android emulator reaches the host via the 10.0.2.2 alias", () => {
  expect(emulatorHost("android")).toBe("10.0.2.2");
});

test("ios and web use localhost", () => {
  expect(emulatorHost("ios")).toBe("localhost");
  expect(emulatorHost("web")).toBe("localhost");
});
