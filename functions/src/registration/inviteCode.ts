import { createHash } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 36 symbols
const CODE_LENGTH = 6;

/** One hour, in ms — an invitation's lifetime. */
export const INVITE_TTL_MS = 3_600_000;

/** A 6-char uppercase-alphanumeric code. `random` is injectable for tests. */
export function generateInviteCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.min(ALPHABET.length - 1, Math.floor(random() * ALPHABET.length));
    code += ALPHABET[idx];
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
