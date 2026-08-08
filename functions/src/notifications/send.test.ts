import { expect, test } from "@jest/globals";
import { FCM_BATCH_SIZE, chunk, targetData } from "./send";

test("chunk splits into batches of at most `size`", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("chunk of an empty list is an empty list of batches", () => {
  expect(chunk([], 10)).toEqual([]);
});

test("chunk leaves a list shorter than `size` in one batch", () => {
  expect(chunk([1, 2], 500)).toEqual([[1, 2]]);
});

test("the FCM batch size respects sendEachForMulticast's 500-token cap", () => {
  expect(FCM_BATCH_SIZE).toBeLessThanOrEqual(500);
});

test("targetData serializes every target as flat strings", () => {
  // FCM data values must be strings — a number or a nested object is rejected
  // at send time, not at compile time.
  expect(targetData({ kind: "company", companyId: "comp_1" })).toEqual({
    kind: "company",
    companyId: "comp_1",
  });
  expect(targetData({ kind: "dossier", dossierId: "dos_1" })).toEqual({
    kind: "dossier",
    dossierId: "dos_1",
  });
  expect(targetData({ kind: "chat", dossierId: "dos_1" })).toEqual({
    kind: "chat",
    dossierId: "dos_1",
  });
});

test("every targetData value is a string", () => {
  const data = targetData({ kind: "dossier", dossierId: "dos_1" });
  for (const value of Object.values(data)) {
    expect(typeof value).toBe("string");
  }
});
