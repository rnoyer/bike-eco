/** Shared option lists for the vehicle forms (b2c + b2b submission). */
export const OUI_NON = ["oui", "non"];
export const COUNT_OPTIONS = ["0", "1", "2", "3", "4"];
export const ETAT_OPTIONS = [
  "Bon état",
  "En Panne",
  "Fort kilométrage",
  "Refus au Contrôle Technique",
  "Mauvais Etat",
  "Accidenté",
];
export const RESULTAT_CT_OPTIONS = ["Favorable", "Défavorable"];

// Named individually because the dossier page reads them back out of
// `vehicle.materiel` — the funnel stores the checkbox *label*, so both sides
// have to agree on one string rather than keep a copy each.
export const MATERIEL_BATTERIE = "J'ai la batterie";
export const MATERIEL_CHARGEUR = "J'ai le chargeur";
export const MATERIEL_OPTIONS = [MATERIEL_BATTERIE, MATERIEL_CHARGEUR];

// Same coupling as MATERIEL_*: the "clé main libre (keyless)" checkbox group
// stores its *labels*, and the dossier page reads them back out of
// `keys.keyless`, so both sides have to agree on one string.
export const KEYLESS_CODE = "Code";
export const KEYLESS_CLE_SECOURS = "Clé de secours";
export const KEYLESS_OPTIONS = [KEYLESS_CODE, KEYLESS_CLE_SECOURS];

/**
 * Character caps for the two submission funnels' text inputs.
 *
 * Each is used three times over: as the input's `maxLength`, as the Zod
 * `.max()` in both funnels' schemas, and — mirrored, because the functions
 * package compiles in isolation and cannot import app sources (same reason as
 * `functions/src/regions.ts` and `labels.ts`) — as the cap in
 * `functions/src/payload.ts`, which validates the *public* B2C endpoint.
 * Change one, change all of them.
 */
export const SHORT_TEXT_MAX = 120; // single-line: marque, modèle, ville, nom…
export const FREE_TEXT_MAX = 2000; // multiline: accessoires, commentaires
export const NUMBER_TEXT_MAX = 9; // digit strings: kilométrage, prix, cylindrée

/** "Numéro d'immatriculation" is capped at 15 characters — long enough for the
 *  French "AA-123-AA" and for the foreign plates the funnel also accepts. The
 *  input's `maxLength` and the schemas' `.max()` both read it, so the field
 *  cannot accept more than the schema allows. */
export const IMMATRICULATION_MAX = 15;
