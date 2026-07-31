/**
 * NORTH / SOUTH département routing for B2C submissions.
 *
 * Mirrors the source of truth in `src/constants/departments.ts` (the Expo app).
 * Kept duplicated because the functions package compiles in isolation and
 * cannot cleanly import from the app sources. Keep both lists in sync when the
 * département → centre mapping changes.
 */

// Departments whose nearest drop-off centre is Pressigny-les-Pins (north).
const NORTH_CODES = new Set([
  "02", "08", "10", "14", "18", "21", "22", "25", "27", "28", "29",
  "35", "36", "37", "39", "41", "44", "45", "49", "50", "51", "52",
  "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "67",
  "68", "70", "71", "72", "75", "76", "77", "78", "80", "85", "88",
  "89", "90", "91", "92", "93", "94", "95",
]);

// Departments whose nearest drop-off centre is Vitrolles (south).
const SOUTH_CODES = new Set([
  "01", "03", "04", "05", "06", "07", "09", "11", "12", "13", "15",
  "16", "17", "19", "23", "24", "26", "30", "31", "32", "33", "34",
  "38", "40", "42", "43", "46", "47", "48", "63", "64", "65", "66",
  "69", "73", "74", "79", "81", "82", "83", "84", "86", "87", "2A", "2B",
]);

export type Region = "NORTH" | "SOUTH";

/** Extract the département code from a "33 - Gironde" style label. */
function getCode(departement: string): string {
  return departement.split(" - ")[0].trim();
}

/**
 * Resolve which Bike-eco centre handles a département. Falls back to NORTH for
 * unknown / empty values so a submission is never dropped.
 */
export function resolveRegion(departement: string): Region {
  const code = getCode(departement || "");
  if (SOUTH_CODES.has(code)) return "SOUTH";
  if (NORTH_CODES.has(code)) return "NORTH";
  return "NORTH";
}
