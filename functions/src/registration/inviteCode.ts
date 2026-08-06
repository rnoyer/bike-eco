import { createHash, randomInt } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 36 symbols
const CODE_LENGTH = 6;

/** One hour, in ms — an invitation's lifetime. */
export const INVITE_TTL_MS = 3_600_000;

/**
 * A 6-char uppercase-alphanumeric code. Redeemed unauthenticated by
 * `acceptInvite` and can mint a `backoffice` identity, so the picker must be
 * unpredictable: `node:crypto`'s CSPRNG, not `Math.random` — V8's
 * xorshift128+ state is recoverable from a handful of observed outputs, and
 * an admin sees their own codes, making prediction the realistic attack.
 * `pickIndex` is injectable for deterministic tests.
 */
export function generateInviteCode(
  pickIndex: (max: number) => number = (max) => randomInt(max),
): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[pickIndex(ALPHABET.length)];
  }
  return code;
}

/** Trim + uppercase what a user typed, so lookups are case-insensitive. */
export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

/** sha256 hex of the normalized code. We store this, never the raw code. */
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(normalizeInviteCode(code)).digest("hex");
}
