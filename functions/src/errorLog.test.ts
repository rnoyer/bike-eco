import { describe, expect, test } from "@jest/globals";

import { callableName, internalErrorLog } from "./errorLog";

describe("callableName", () => {
  test("reports the Cloud Run service name Gen 2 sets on every instance", () => {
    expect(callableName({ K_SERVICE: "registercompany" })).toBe("registercompany");
  });

  test("falls back to a marker when K_SERVICE is absent, as it is locally", () => {
    expect(callableName({})).toBe("unknown");
  });
});

describe("internalErrorLog", () => {
  test("names the failing callable, so one alert points at one function", () => {
    const entry = internalErrorLog(new Error("boom"), "uid-1", { K_SERVICE: "sendmessage" });
    expect(entry.function).toBe("sendmessage");
  });

  test("carries the caller's uid, so a failure can be traced to one account", () => {
    const entry = internalErrorLog(new Error("boom"), "uid-1", { K_SERVICE: "sendmessage" });
    expect(entry.uid).toBe("uid-1");
  });

  test("marks a signed-out caller rather than dropping the field", () => {
    // publicCall reaches toHttps with no identity; a consistently present field
    // keeps the log-based metric's filters simple.
    const entry = internalErrorLog(new Error("boom"), null, { K_SERVICE: "registercompany" });
    expect(entry.uid).toBe("anonymous");
  });

  test("keeps the error's message and class", () => {
    const entry = internalErrorLog(new TypeError("bad type"), "uid-1", {});
    expect(entry.errorName).toBe("TypeError");
    expect(entry.error).toBe("bad type");
  });

  test("survives a non-Error throw", () => {
    const entry = internalErrorLog("plain string", "uid-1", {});
    expect(entry.errorName).toBe("unknown");
    expect(entry.error).toBe("plain string");
  });

  test("keeps the stack of a real Error — the reason to read the log at all", () => {
    const entry = internalErrorLog(new Error("boom"), "uid-1", {});
    expect(entry.stack).toContain("errorLog.test.ts");
  });

  test("omits the stack when the thrown value has none", () => {
    const entry = internalErrorLog({ code: 42 }, "uid-1", {});
    expect(entry.stack).toBeUndefined();
  });
});
