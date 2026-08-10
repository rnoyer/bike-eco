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
