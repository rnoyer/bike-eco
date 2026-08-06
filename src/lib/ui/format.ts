import type { DossierStatus, Region } from "@/lib/firestore/schema";
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

export const regionLabel = (region: Region): string =>
  region === "NORTH" ? "Nord" : "Sud";

/** The three dossier statuses in French. `StatusBadge` reads these too, so the
 *  badge and the "Statut" info row cannot drift apart. */
export const STATUS_LABELS: Record<DossierStatus, string> = {
  a_traiter: "À traiter",
  en_cours: "En cours",
  cloture: "Clôturé",
};

export const statusLabel = (status: DossierStatus): string =>
  STATUS_LABELS[status];
