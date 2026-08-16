import { expect, test } from "@jest/globals";
import { emulatorHost, functions } from "./firebase.core";

// The region is a contract with `setGlobalOptions` in `functions/src/index.ts`.
// A mismatch does not throw at startup — the SDK just calls a URL with no
// function behind it and every callable fails as a generic `internal`. Pin it.
test("callables target the region the functions are deployed to", () => {
  expect(functions.region).toBe("europe-west9");
});

test("android emulator reaches the host via the 10.0.2.2 alias", () => {
  expect(emulatorHost("android")).toBe("10.0.2.2");
});

test("ios and web use localhost", () => {
  expect(emulatorHost("ios")).toBe("localhost");
  expect(emulatorHost("web")).toBe("localhost");
});
