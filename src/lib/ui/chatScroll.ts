/**
 * How far from the bottom of the thread still counts as "reading the latest".
 * Generous by a bubble's worth of padding: a user who has nudged the list a few
 * points still expects the next message to follow them down.
 */
export const STICK_THRESHOLD = 48;

/**
 * Whether a chat thread's scroll position is at (or within {@link STICK_THRESHOLD}
 * of) its end — the one condition under which an incoming message may scroll the
 * view. Someone who has deliberately scrolled up to read history must not be
 * yanked back down by a message arriving.
 *
 * The three numbers are exactly what a `ScrollView` reports in `onScroll`
 * (`contentSize.height`, `contentOffset.y`, `layoutMeasurement.height`). A
 * thread shorter than the window, and an iOS bounce past the end, both give a
 * negative distance and read as "at the bottom" — which is what they are.
 */
export function isNearBottom(
  scroll: { contentHeight: number; offsetY: number; viewportHeight: number },
  threshold: number = STICK_THRESHOLD,
): boolean {
  const distanceFromEnd =
    scroll.contentHeight - (scroll.offsetY + scroll.viewportHeight);
  return distanceFromEnd <= threshold;
}
