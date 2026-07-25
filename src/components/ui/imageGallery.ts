/** Keep an "open at" index inside [0, length). Empty/out-of-range → nearest valid (0). */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(index)));
}
