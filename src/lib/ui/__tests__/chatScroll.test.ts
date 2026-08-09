import { expect, test } from "@jest/globals";
import { isNearBottom, STICK_THRESHOLD } from "../chatScroll";

/** A 600pt-tall window over a 2000pt-tall thread: the bottom sits at y=1400. */
const view = (offsetY: number) => ({
  contentHeight: 2000,
  viewportHeight: 600,
  offsetY,
});

test("pinned to the very bottom", () => {
  expect(isNearBottom(view(1400))).toBe(true);
});

test("a hair off the bottom still counts — a new bubble should follow", () => {
  expect(isNearBottom(view(1400 - STICK_THRESHOLD))).toBe(true);
});

test("scrolled up to read history does not count", () => {
  expect(isNearBottom(view(1400 - STICK_THRESHOLD - 1))).toBe(false);
  expect(isNearBottom(view(0))).toBe(false);
});

test("a thread shorter than the window is always at its bottom", () => {
  expect(
    isNearBottom({ contentHeight: 200, viewportHeight: 600, offsetY: 0 }),
  ).toBe(true);
});

test("overscrolled past the end (iOS bounce) is still the bottom", () => {
  expect(isNearBottom(view(1480))).toBe(true);
});
