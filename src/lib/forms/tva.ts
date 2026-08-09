/**
 * French VAT number ("numéro de TVA intracommunautaire"):
 * `FR` + a 2-character key (digits or letters) + the 9-digit SIREN, which is
 * the first 9 digits of the company's SIRET — 13 characters in all.
 * e.g. SIRET `12345678901234` → TVA `FR1A123456789`.
 *
 * The field is optional throughout the app: an empty value is valid, a filled
 * one must be complete and consistent with the SIRET.
 */
export const TVA_LENGTH = 13;

/** The shape a filled TVA number must have, once normalized. */
const TVA_PATTERN = /^FR[0-9A-Z]{2}\d{9}$/;

/** Uppercases and strips separators — the canonical form of a typed value. */
const stripTva = (text: string): string =>
  text.toUpperCase().replace(/[^0-9A-Z]/g, "");

/** `stripTva` capped at 13 characters — for the input transform. */
export const normalizeTva = (text: string): string =>
  stripTva(text).slice(0, TVA_LENGTH);

/**
 * The French error message for a TVA number, or `null` when it is acceptable.
 * `siret` is the raw SIRET field: the cross-check is skipped while it is not
 * itself 14 digits, so the user fixes one error at a time.
 */
export function tvaIssue(rawTva: string, siret: string): string | null {
  // Stripped, not capped: a too-long value must error rather than be trimmed
  // into a valid one behind the user's back.
  const tva = stripTva(rawTva);
  if (!tva) return null; // optional — an empty field passes
  if (!tva.startsWith("FR")) return 'Le numéro de TVA doit commencer par "FR"';
  if (!TVA_PATTERN.test(tva)) return "Ceci ne correspond pas à un numéro de TVA.";
  if (/^\d{14}$/.test(siret) && tva.slice(4) !== siret.slice(0, 9)) {
    return "Le numéro de TVA et le numéro SIRET doivent correspondre";
  }
  return null;
}
