import type { DossierStatus, Region, UserRole } from "@/lib/firestore/schema";
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

/** The status as a given role is allowed to see it. `a_traiter` is the back
 *  office's own working state — a b2b user only ever sees "En cours" until the
 *  dossier is clôturé. Project once at the screen, then the badge and the
 *  "Statut" row both follow (same label *and* same blue `en_cours` palette). */
export const viewerStatus = (
  status: DossierStatus,
  role: UserRole,
): DossierStatus =>
  role === "b2b" && status === "a_traiter" ? "en_cours" : status;
