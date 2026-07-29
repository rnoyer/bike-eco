const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"; // 62 symbols
const SUFFIX_LENGTH = 6;

/**
 * A company's Firestore document id: `<siret>-<6 alphanumerics>`, e.g.
 * `12345678901234-aB3xY9`. Readable in the console, unlike an auto-generated id.
 *
 * The SIRET alone would do — `companyExistsForSiret` rejects a second registration —
 * but a bare SIRET is a monotonic-ish key, and Firestore stores documents ordered by
 * key, so the random suffix keeps writes spread across the keyspace.
 *
 * `random` is injectable for tests.
 */
export function generateCompanyId(siret: string, random: () => number = Math.random): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    const idx = Math.min(ALPHABET.length - 1, Math.floor(random() * ALPHABET.length));
    suffix += ALPHABET[idx];
  }
  return `${siret}-${suffix}`;
}
