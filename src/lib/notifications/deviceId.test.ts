import { beforeEach, expect, jest, test } from "@jest/globals";
import Storage from "expo-sqlite/kv-store";

import { __resetDeviceIdForTests, getDeviceId } from "./deviceId";

jest.mock("expo-sqlite/kv-store", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn() },
}));

const storage = Storage as unknown as {
  getItem: jest.Mock<(key: string) => Promise<string | null>>;
  setItem: jest.Mock<(key: string, value: string) => Promise<void>>;
};

/** Backs the mock with a real store, so a write is visible to the next read. */
function useStore(initial: Record<string, string> = {}) {
  const store: Record<string, string> = { ...initial };
  storage.getItem.mockImplementation(async (key) => store[key] ?? null);
  storage.setItem.mockImplementation(async (key, value) => {
    store[key] = value;
  });
  return store;
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetDeviceIdForTests();
});

test("returns the id already in storage", async () => {
  useStore({ "push.deviceId": "existing-id" });
  await expect(getDeviceId()).resolves.toBe("existing-id");
  expect(storage.setItem).not.toHaveBeenCalled();
});

test("mints and persists an id when storage is empty", async () => {
  const store = useStore();
  const id = await getDeviceId();
  expect(id).toBeTruthy();
  expect(store["push.deviceId"]).toBe(id);
});

// The regression this module's single-flight exists for. Two overlapping
// registration attempts on a first launch each read an empty key and minted
// their own id, leaving the device with two pushTokens rows on one live FCM
// handle - an orphan nothing prunes and sign-out cannot reach.
test("gives concurrent callers one id, and writes it once", async () => {
  const store = useStore();

  const [a, b, c] = await Promise.all([
    getDeviceId(),
    getDeviceId(),
    getDeviceId(),
  ]);

  expect(b).toBe(a);
  expect(c).toBe(a);
  expect(storage.setItem).toHaveBeenCalledTimes(1);
  expect(store["push.deviceId"]).toBe(a);
});

test("keeps returning the same id without re-reading storage", async () => {
  useStore({ "push.deviceId": "existing-id" });
  await getDeviceId();
  await expect(getDeviceId()).resolves.toBe("existing-id");
  expect(storage.getItem).toHaveBeenCalledTimes(1);
});

test("recovers from a failed read instead of caching the rejection", async () => {
  storage.getItem.mockImplementation(() =>
    Promise.reject(new Error("database is locked")),
  );
  await expect(getDeviceId()).rejects.toThrow("database is locked");

  useStore({ "push.deviceId": "existing-id" });
  await expect(getDeviceId()).resolves.toBe("existing-id");
});
