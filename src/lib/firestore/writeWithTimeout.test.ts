import { expect, jest, test } from "@jest/globals";
import { writeWithTimeout } from "./writeWithTimeout";

test("returns the write result when it settles before the timeout", async () => {
  const compensate = jest.fn();
  const result = await writeWithTimeout(
    () => Promise.resolve("ok"),
    compensate,
    50,
  );
  expect(result).toBe("ok");
  expect(compensate).not.toHaveBeenCalled();
});

test("a hanging write is failed fast: compensates and rejects `unavailable`", async () => {
  const compensate = jest.fn();
  // Firestore buffers a write it can't reach the server with — the promise never
  // settles. The timeout must win so the caller sees a network error, not a hang.
  const neverSettles = new Promise<void>(() => {});
  await expect(
    writeWithTimeout(() => neverSettles, compensate, 20),
  ).rejects.toMatchObject({ code: "unavailable" });
  expect(compensate).toHaveBeenCalledTimes(1);
});

test("a real write rejection propagates unchanged and does not compensate", async () => {
  const compensate = jest.fn();
  const denied = Object.assign(new Error("nope"), { code: "permission-denied" });
  await expect(
    writeWithTimeout(() => Promise.reject(denied), compensate, 50),
  ).rejects.toBe(denied);
  expect(compensate).not.toHaveBeenCalled();
});
