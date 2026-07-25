import { expect, test } from "@jest/globals";
import { clampIndex } from "./imageGallery";

test("keeps an in-range index", () => {
  expect(clampIndex(1, 3)).toBe(1);
});

test("clamps below 0 and at/above length", () => {
  expect(clampIndex(-2, 3)).toBe(0);
  expect(clampIndex(3, 3)).toBe(2);
  expect(clampIndex(9, 3)).toBe(2);
});

test("floors a fractional index", () => {
  expect(clampIndex(1.9, 3)).toBe(1);
});

test("empty list clamps to 0", () => {
  expect(clampIndex(0, 0)).toBe(0);
  expect(clampIndex(4, 0)).toBe(0);
});
