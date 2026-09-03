/**
 * Shared server-side copy of `src/lib/ui/format.ts`, used by both the
 * notification copy and the dossier recap email.
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

export type OuiNon = "oui" | "non";

export const REGION_LABELS: Record<Region, string> = {
  NORTH: "Nord",
  SOUTH: "Sud",
};

export const kilometres = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : `${n} km`;

/**
 * A stored `OuiNon`, capitalised for an email body. An unanswered field
 * becomes "" rather than "—": the email templates drop empty rows, and a row
 * the funnel never asked is better absent than dashed.
 */
export const ouiNon = (v: string | null | undefined): string =>
  v === "oui" ? "Oui" : v === "non" ? "Non" : "";

// The funnel stores the checkbox *label* in `vehicle.materiel`, so both sides
// have to agree on one string. Mirrors `MATERIEL_*` in src/constants/vehicle.ts.
const MATERIEL_BATTERIE = "J'ai la batterie";
const MATERIEL_CHARGEUR = "J'ai le chargeur";

export const hasMateriel = (
  materiel: string[] | null | undefined,
  item: "batterie" | "chargeur",
): boolean =>
  (materiel ?? []).includes(
    item === "batterie" ? MATERIEL_BATTERIE : MATERIEL_CHARGEUR,
  );

// Same coupling for the "clé main libre (keyless)" checkbox group, stored in
// `keys.keyless`. Mirrors `KEYLESS_*` in src/constants/vehicle.ts.
const KEYLESS_CODE = "Code";
const KEYLESS_CLE_SECOURS = "Clé de secours";

export const hasKeyless = (
  keyless: string[] | null | undefined,
  item: "code" | "secours",
): boolean =>
  (keyless ?? []).includes(item === "code" ? KEYLESS_CODE : KEYLESS_CLE_SECOURS);

/**
 * "26 juil. 2026 14:30" — JJ MMM AAAA hh:mm, in Paris time.
 *
 * The zone is explicit because Cloud Functions run in UTC: without it a
 * dossier submitted at 00:30 Paris time would be dated the previous day in the
 * email while the app, running on the user's device, shows it correctly.
 *
 * Takes anything with a `toDate()` — an admin-SDK `Timestamp` satisfies it —
 * so this stays testable without a Firebase import.
 */
export function submittedAt(
  ts: { toDate(): Date } | null | undefined,
): string {
  if (!ts) return "—";
  const d = ts.toDate();
  const date = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });
  return `${date} ${time}`;
}

/**
 * "11 août 2026 09:06:21" — when a document was produced, in Paris time.
 *
 * To the second, unlike `submittedAt`. Two recaps of an unchanged dossier would
 * otherwise be byte-identical, and Gmail threads messages that share a subject
 * and hides whatever repeats an earlier one behind "Show trimmed content" — so
 * a resend arrives looking blank. A timestamp that always differs is what keeps
 * every send its own message.
 */
export function generatedAt(date: Date): string {
  const day = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
  const time = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Paris",
  });
  return `${day} ${time}`;
}
