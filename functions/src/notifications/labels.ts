/**
 * French labels and formatters for notification copy.
 *
 * Duplicated from `src/lib/ui/format.ts` in the Expo app, for the same reason
 * `functions/src/regions.ts` duplicates the département map: the functions
 * package compiles in isolation and cannot cleanly import from the app
 * sources. Keep both copies in sync when a label or a unit changes.
 */

export type Region = "NORTH" | "SOUTH";
export type UserRole = "b2b" | "backoffice";
export type DossierStatus = "a_traiter" | "en_cours" | "cloture";

export const STATUS_LABELS: Record<DossierStatus, string> = {
  a_traiter: "À traiter",
  en_cours: "En cours",
  cloture: "Clôturé",
};

/** Units live in the value; an absent price is dashed, never "null €". */
export const euros = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : `${n} €`;
