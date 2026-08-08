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

/**
 * The status as a given role is allowed to see it. `a_traiter` is the back
 * office's own working state — a b2b user only ever sees "En cours" until the
 * dossier is clôturé.
 *
 * Duplicated from `viewerStatus` in `src/lib/ui/format.ts` for the same reason
 * as the labels above. It matters here and not only on screen: the management
 * form can move a dossier back to "À traiter", and a notification rendered
 * from the raw status would tell a dealer "Nouveau statut: À traiter" about a
 * screen that says "En cours" — contradicting the app and leaking an internal
 * state. Keep both copies in sync.
 */
export const viewerStatus = (
  status: DossierStatus,
  role: UserRole,
): DossierStatus =>
  role === "b2b" && status === "a_traiter" ? "en_cours" : status;
