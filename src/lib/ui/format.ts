import { MATERIEL_BATTERIE, MATERIEL_CHARGEUR } from "@/constants/vehicle";
import type {
  DossierStatus,
  OuiNon,
  Region,
  UserRole,
} from "@/lib/firestore/schema";
import type { Timestamp } from "firebase/firestore";

/** "—" for an absent value. Never print "null" or leave a row blank. */
export const dash = (v: unknown): string =>
  v === null || v === undefined || v === "" ? "—" : String(v);

/** "26 juil. 2026 14:30" — JJ MMM AAAA hh:mm. */
export function submittedAt(createdAt: Timestamp | null | undefined): string {
  if (!createdAt) return "—";
  const d = createdAt.toDate();
  const date = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

// Units live in the value, and an absent field is dashed rather than rendered
// as a bare unit ("—", not "— €").
export const euros = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : `${n} €`;

export const kilometres = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : `${n} km`;

/** A `Record`, not a ternary: adding a region then fails to compile here
 *  instead of silently rendering "Sud". */
export const REGION_LABELS: Record<Region, string> = {
  NORTH: "Nord",
  SOUTH: "Sud",
};

export const regionLabel = (region: Region): string => REGION_LABELS[region];

/** The three dossier statuses in French. `StatusBadge` reads these too, so the
 *  badge and the "Statut" info row cannot drift apart. */
export const STATUS_LABELS: Record<DossierStatus, string> = {
  a_traiter: "À traiter",
  en_cours: "En cours",
  cloture: "Clôturé",
};

export const statusLabel = (status: DossierStatus): string =>
  STATUS_LABELS[status];

/**
 * Dropdown options for a label table, plus the inverse lookup.
 *
 * `Dropdown` works in labels: it displays them and hands back the one the user
 * picked. Without this a screen ends up keeping its own copy of the French copy
 * just to map the answer home — which is exactly how a third copy of
 * `STATUS_LABELS` came to exist. `valueOf` is total over the labels it just
 * produced, so the assertion cannot fire for a value the dropdown returned.
 */
export function labelledOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { labels: string[]; valueOf: (label: string) => T } {
  return {
    labels: values.map((v) => labels[v]),
    valueOf: (label) => values.find((v) => labels[v] === label)!,
  };
}

/** The status as a given role is allowed to see it. `a_traiter` is the back
 *  office's own working state — a b2b user only ever sees "En cours" until the
 *  dossier is clôturé. Project once at the screen, then the badge and the
 *  "Statut" row both follow (same label *and* same blue `en_cours` palette). */
export const viewerStatus = (
  status: DossierStatus,
  role: UserRole,
): DossierStatus =>
  role === "b2b" && status === "a_traiter" ? "en_cours" : status;

/**
 * `true` only for the stored `"oui"`.
 *
 * The dossier's collapsible rows use it to decide whether they have anything to
 * reveal: every sub-answer (`carteGriseAVotreNom`, the key counts, the CT
 * result…) is left `null` by the funnel unless the parent answer was "oui".
 */
export const isOui = (v: string | null | undefined): boolean => v === "oui";

/** Renders a *derived* boolean in the same vocabulary as a stored `OuiNon`, so
 *  "Batterie présente : oui" reads like the rows around it. */
export const ouiNon = (v: boolean): OuiNon => (v ? "oui" : "non");

/**
 * Whether the seller checked "J'ai la batterie" / "J'ai le chargeur".
 *
 * `vehicle.materiel` stores the funnel's checkbox *labels*, so the coupling to
 * that French copy lives here rather than in the screen — the dossier asks for
 * `"batterie"` and renders its own "Batterie présente" label.
 */
export const hasMateriel = (
  materiel: string[] | null | undefined,
  item: "batterie" | "chargeur",
): boolean =>
  (materiel ?? []).includes(
    item === "batterie" ? MATERIEL_BATTERIE : MATERIEL_CHARGEUR,
  );
