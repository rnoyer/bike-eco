# Dossier Recap Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A back-office user reading a dossier taps `M'envoyer par email` and receives an HTML recap of that dossier at the address on their own account.

**Architecture:** A new `sendDossierRecap` callable in `functions/` takes only a `dossierId`, re-reads the dossier and the caller's profile server-side, renders HTML with the same helpers the existing B2C emails use, and sends it. The client sends nothing but the id and shows a confirmation screen that names no mailbox. Two shared modules are extracted first so nothing is copy-pasted: `functions/src/emailHtml.ts` (template helpers) and `functions/src/labels.ts` (French formatters, promoted from `notifications/labels.ts`).

**Tech Stack:** TypeScript, Firebase Cloud Functions v2 (`onCall` via the repo's `authedCall` wrapper), Zod v4, nodemailer, Jest + ts-jest in `functions/`, Expo Router + React Native in `src/`.

**Design spec:** `docs/superpowers/specs/2026-08-11-dossier-recap-email-design.md` — read it before starting.

## Global Constraints

- **Back-office only.** The callable rejects any caller whose claim `role !== "backoffice"`; the B2B screen renders no button.
- **The client sends only `{ dossierId }`.** The recipient address is derived from the verified token's uid, server-side. Never accept an address from the payload.
- **The recipient address never leaves the server.** The callable returns `{ ok: true }`; the confirmation reads "Récapitulatif envoyé à votre adresse email".
- **All user-facing copy is French**, and is quoted verbatim in the tasks below. Do not paraphrase it.
- **Empty rows are dropped**, not dashed — `rowsHtml` already does this for the B2C emails.
- **Dates render in `Europe/Paris`.** Functions run in UTC.
- **Tests:** pure logic only (`core.ts`, `render.ts`, `schemas.ts`). No render tests for screens — see `docs/tech/verification.md`.
- **Import jest globals explicitly:** `import { describe, expect, test } from "@jest/globals";`
- **Two separate packages.** `functions/` cannot import from `src/`. Run `functions/` tests from `functions/`, app checks from the repo root.
- **Existing behaviour must not change.** The two B2C emails and the four notification triggers must render byte-identically after the extractions in Tasks 1 and 2.

## Verification commands

| Scope | Command | Run from |
|---|---|---|
| Functions tests | `npm test` | `functions/` |
| Functions typecheck | `npx tsc --noEmit` | `functions/` |
| Functions lint | `npm run lint` | `functions/` |
| App gate | `npx tsc --noEmit && npx expo lint && npm test` | repo root |

---

### Task 1: Promote `labels.ts` to a shared module and extend it

The recap renderer needs French formatters. `functions/src/notifications/labels.ts` already holds half of them. Move it up one level and add the rest, so there is exactly one server-side copy.

**Files:**
- Create: `functions/src/labels.ts` (moved from `functions/src/notifications/labels.ts`)
- Delete: `functions/src/notifications/labels.ts`
- Modify: `functions/src/notifications/copy.ts:7` (import path)
- Modify: `functions/src/notifications/core.ts:11` (import path)
- Modify: `functions/src/notifications/index.ts:7` (import path)
- Test: `functions/src/labels.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: from `functions/src/labels.ts` —
  - types `Region = "NORTH" | "SOUTH"`, `UserRole = "b2b" | "backoffice"`, `DossierStatus = "a_traiter" | "en_cours" | "cloture"`, `OuiNon = "oui" | "non"`
  - `STATUS_LABELS: Record<DossierStatus, string>`
  - `REGION_LABELS: Record<Region, string>`
  - `viewerStatus(status: DossierStatus, role: UserRole): DossierStatus`
  - `euros(n: number | null | undefined): string`
  - `kilometres(n: number | null | undefined): string`
  - `ouiNon(v: string | null | undefined): string`
  - `hasMateriel(materiel: string[] | null | undefined, item: "batterie" | "chargeur"): boolean`
  - `submittedAt(ts: { toDate(): Date } | null | undefined): string`

- [ ] **Step 1: Move the file, unchanged**

```bash
cd functions
git mv src/notifications/labels.ts src/labels.ts
```

- [ ] **Step 2: Fix the three import paths**

In `src/notifications/copy.ts`, `src/notifications/core.ts` and `src/notifications/index.ts`, change `"./labels"` to `"../labels"`. Change nothing else in those files.

- [ ] **Step 3: Verify the move broke nothing**

Run (from `functions/`): `npx tsc --noEmit && npm test`
Expected: PASS. The notification tests still cover every symbol that moved.

- [ ] **Step 4: Write the failing test for the new formatters**

Create `functions/src/labels.test.ts`:

```ts
import { describe, expect, test } from "@jest/globals";
import {
  hasMateriel,
  kilometres,
  ouiNon,
  REGION_LABELS,
  submittedAt,
} from "./labels";

describe("kilometres", () => {
  test("puts the unit in the value", () => {
    expect(kilometres(48000)).toBe("48000 km");
  });

  test("dashes an absent distance rather than printing a bare unit", () => {
    expect(kilometres(null)).toBe("—");
    expect(kilometres(undefined)).toBe("—");
  });
});

describe("ouiNon", () => {
  test("capitalises the stored answer, as the B2C emails do", () => {
    expect(ouiNon("oui")).toBe("Oui");
    expect(ouiNon("non")).toBe("Non");
  });

  test("returns the empty string for an unanswered field, so the row drops", () => {
    expect(ouiNon(null)).toBe("");
    expect(ouiNon(undefined)).toBe("");
  });
});

describe("hasMateriel", () => {
  test("reads the funnel's checkbox labels", () => {
    const materiel = ["J'ai la batterie"];
    expect(hasMateriel(materiel, "batterie")).toBe(true);
    expect(hasMateriel(materiel, "chargeur")).toBe(false);
  });

  test("tolerates a missing list", () => {
    expect(hasMateriel(null, "batterie")).toBe(false);
    expect(hasMateriel(undefined, "chargeur")).toBe(false);
  });
});

describe("REGION_LABELS", () => {
  test("names both régions in French", () => {
    expect(REGION_LABELS.NORTH).toBe("Nord");
    expect(REGION_LABELS.SOUTH).toBe("Sud");
  });
});

describe("submittedAt", () => {
  // 2026-07-26T12:30:00Z is 14:30 in Paris (CEST, UTC+2). Functions run in
  // UTC, so a formatter without an explicit zone would print 12:30 here.
  test("formats in Europe/Paris as JJ MMM AAAA hh:mm", () => {
    const ts = { toDate: () => new Date("2026-07-26T12:30:00Z") };
    expect(submittedAt(ts)).toBe("26 juil. 2026 14:30");
  });

  // 00:30 Paris on the 1st is 22:30 UTC on the previous day — the case that
  // would silently date a dossier a day early.
  test("keeps a just-after-midnight submission on the Paris day", () => {
    const ts = { toDate: () => new Date("2026-06-30T22:30:00Z") };
    expect(submittedAt(ts)).toBe("01 juil. 2026 00:30");
  });

  test("dashes an absent timestamp", () => {
    expect(submittedAt(null)).toBe("—");
    expect(submittedAt(undefined)).toBe("—");
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run (from `functions/`): `npx jest src/labels.test.ts`
Expected: FAIL — `kilometres`, `ouiNon`, `hasMateriel`, `REGION_LABELS` and `submittedAt` are not exported yet.

- [ ] **Step 6: Add the formatters to `functions/src/labels.ts`**

Append to the file (keep everything already there untouched), and update the file's top doc-comment to say it is the shared server-side copy of `src/lib/ui/format.ts`, used by both the notification copy and the dossier recap email:

```ts
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
```

- [ ] **Step 7: Run the tests to verify they pass**

Run (from `functions/`): `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS on all three. If `submittedAt` fails on the month abbreviation, print the actual value first — Node's ICU renders `fr-FR` short months as "juil." with the trailing dot; do not "fix" the test by loosening it without checking.

- [ ] **Step 8: Commit**

```bash
git add functions/src/labels.ts functions/src/labels.test.ts functions/src/notifications/
git commit -m "refactor(functions): share the French label helpers"
```

---

### Task 2: Extract the email HTML helpers

`functions/src/email.ts` keeps its template helpers private. The recap needs them. Move them out with zero behaviour change.

**Files:**
- Create: `functions/src/emailHtml.ts`
- Modify: `functions/src/email.ts` (delete the moved helpers, import them instead)
- Test: `functions/src/emailHtml.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: from `functions/src/emailHtml.ts` —
  - `type Row = [label: string, value: string | null | undefined]`
  - `esc(value: string): string`
  - `rowsHtml(rows: Row[]): string`
  - `section(title: string, rows: Row[]): string`
  - `shell(title: string, intro: string, body: string): string`

- [ ] **Step 1: Write the failing test**

Create `functions/src/emailHtml.test.ts`:

```ts
import { describe, expect, test } from "@jest/globals";
import { esc, rowsHtml, section, shell } from "./emailHtml";

describe("esc", () => {
  test("escapes the three characters that would break out of the markup", () => {
    expect(esc('<b>Tom & "co"</b>')).toBe('&lt;b&gt;Tom &amp; "co"&lt;/b&gt;');
  });
});

describe("rowsHtml", () => {
  test("renders a label and its value", () => {
    const html = rowsHtml([["Marque", "Yamaha"]]);
    expect(html).toContain("Marque");
    expect(html).toContain("Yamaha");
  });

  test("drops rows with no value", () => {
    const html = rowsHtml([
      ["Marque", "Yamaha"],
      ["Année", null],
      ["Modèle", undefined],
      ["Kilométrage", "   "],
    ]);
    expect(html).toContain("Marque");
    expect(html).not.toContain("Année");
    expect(html).not.toContain("Modèle");
    expect(html).not.toContain("Kilométrage");
  });

  test("escapes both label and value", () => {
    expect(rowsHtml([["A & B", "<script>"]])).toContain("&lt;script&gt;");
  });
});

describe("section", () => {
  test("renders its title above the rows", () => {
    const html = section("Informations véhicule", [["Marque", "Yamaha"]]);
    expect(html).toContain("Informations véhicule");
    expect(html).toContain("Yamaha");
  });

  test("renders nothing at all when every row is empty", () => {
    expect(section("Informations véhicule", [["Marque", null]])).toBe("");
  });
});

describe("shell", () => {
  test("wraps title, intro and body", () => {
    const html = shell("Titre", "Intro", "<p>corps</p>");
    expect(html).toContain("Titre");
    expect(html).toContain("Intro");
    expect(html).toContain("<p>corps</p>");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `functions/`): `npx jest src/emailHtml.test.ts`
Expected: FAIL — `Cannot find module './emailHtml'`.

- [ ] **Step 3: Create `functions/src/emailHtml.ts`**

Move the four helpers and the `Row` type out of `email.ts` **verbatim** — same strings, same inline styles, same escaping — and export them:

```ts
/**
 * The shared look of every HTML email Bike-eco sends: the B2C team and
 * customer recaps, and the back-office dossier recap. Extracted from
 * `email.ts` so a second sender cannot start a second template.
 *
 * Inline styles, not a stylesheet: mail clients strip <style> blocks.
 */

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A label/value row, dropped entirely when the value is empty/null. */
export type Row = [label: string, value: string | null | undefined];

export function rowsHtml(rows: Row[]): string {
  const visible = rows.filter(([, v]) => v != null && String(v).trim() !== "");
  return visible
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:4px 12px 4px 0;color:#71727A;font-size:13px;vertical-align:top;">${esc(label)}</td>` +
        `<td style="padding:4px 0;color:#111;font-size:13px;font-weight:600;">${esc(String(value))}</td>` +
        `</tr>`
    )
    .join("");
}

export function section(title: string, rows: Row[]): string {
  const body = rowsHtml(rows);
  if (!body) return "";
  return (
    `<h2 style="font-size:15px;color:#111;margin:20px 0 6px;">${esc(title)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;">${body}</table>`
  );
}

export function shell(title: string, intro: string, body: string): string {
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">` +
    `<h1 style="font-size:22px;color:#111;margin:0 0 8px;">${esc(title)}</h1>` +
    `<p style="font-size:14px;color:#71727A;margin:0 0 8px;">${esc(intro)}</p>` +
    body +
    `</div>`
  );
}
```

- [ ] **Step 4: Delete the originals from `email.ts` and import them**

In `functions/src/email.ts`, remove the `esc`, `rowsHtml`, `section`, `shell` functions and the `Row` type (the whole "HTML rendering helpers" block, lines 126–168), and add near the other imports:

```ts
import { section, shell, type Row } from "./emailHtml";
```

`esc` and `rowsHtml` are no longer referenced directly by `email.ts` — do not import them there. Leave `yesNo`, the sections, and everything else exactly as it is.

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `functions/`): `npm test && npx tsc --noEmit && npm run lint`
Expected: PASS. `tsc` is the real check here — an unused import or a missed reference fails the build.

- [ ] **Step 6: Commit**

```bash
git add functions/src/emailHtml.ts functions/src/emailHtml.test.ts functions/src/email.ts
git commit -m "refactor(functions): extract the shared email template helpers"
```

---

### Task 3: Render the recap email

The whole email as two pure functions, testable without Firebase or SMTP.

**Files:**
- Create: `functions/src/dossierEmail/render.ts`
- Test: `functions/src/dossierEmail/render.test.ts`

**Interfaces:**
- Consumes: `section`, `shell`, `type Row` from `../emailHtml` (Task 2); `euros`, `hasMateriel`, `kilometres`, `ouiNon`, `REGION_LABELS`, `STATUS_LABELS`, `submittedAt`, and the types `DossierStatus`, `OuiNon`, `Region` from `../labels` (Task 1).
- Produces:
  - `interface RecapDossier` (exact shape below) — Task 4's `DossierEmailDeps.getDossier` returns it.
  - `recapSubject(d: RecapDossier): string`
  - `recapHtml(d: RecapDossier): string`

- [ ] **Step 1: Write the failing test**

Create `functions/src/dossierEmail/render.test.ts`:

```ts
import { describe, expect, test } from "@jest/globals";
import { recapHtml, recapSubject, type RecapDossier } from "./render";

/** A fully answered dossier. Tests narrow it with `dossier({ ... })`. */
const FULL: RecapDossier = {
  status: "en_cours",
  region: "SOUTH",
  validatedPrice: 3200,
  createdAt: { toDate: () => new Date("2026-07-26T12:30:00Z") },
  submitter: {
    nom: "Durand",
    prenom: "Claire",
    companyName: "Moto Sud",
    email: "claire@moto-sud.fr",
    telephone: "0601020304",
  },
  vehicle: {
    electrique: "oui",
    materiel: ["J'ai la batterie"],
    marque: "Yamaha",
    modele: "MT-07 689",
    annee: 2019,
    kilometrage: 48000,
    accessoires: "Sacoches neuves",
  },
  keys: {
    aClesContact: "oui",
    cleNoire: 2,
    cleMarron: 0,
    cleRouge: null,
    aTelecommande: "oui",
    telecommande: 1,
  },
  condition: { etat: "En Panne", naturePanne: "Démarreur HS" },
  papers: {
    carteGrise: "oui",
    carteGriseAVotreNom: "oui",
    controleTechnique: "oui",
    ctMoins6Mois: "non",
    resultatCT: "Favorable",
    certificatNonGage: "oui",
    carnetEntretien: "non",
    factureEntretien: "oui",
  },
  pricing: { prix: 3500, commentaires: "Vente rapide souhaitée" },
};

const dossier = (over: Partial<RecapDossier> = {}): RecapDossier => ({
  ...FULL,
  ...over,
});

describe("recapSubject", () => {
  test("names the company and the vehicle", () => {
    expect(recapSubject(FULL)).toBe(
      "Demande de rachat - Moto Sud - Yamaha MT-07 689",
    );
  });
});

describe("recapHtml", () => {
  test("opens with the subject and the intro sentence", () => {
    const html = recapHtml(FULL);
    expect(html).toContain("Demande de rachat - Moto Sud - Yamaha MT-07 689");
    expect(html).toContain(
      "Veuillez trouver le récapitulatif de la demande de rachat soumise dans l'application Bike-eco par Claire Durand, de Moto Sud.",
    );
  });

  test("carries the three sections, in reading order", () => {
    const html = recapHtml(FULL);
    const vehicule = html.indexOf("Informations véhicule");
    const vendeur = html.indexOf("Informations vendeur");
    const dossierSection = html.indexOf("Informations Dossier");
    expect(vehicule).toBeGreaterThan(-1);
    expect(vendeur).toBeGreaterThan(vehicule);
    expect(dossierSection).toBeGreaterThan(vendeur);
  });

  test("renders the vehicle's own values with their units", () => {
    const html = recapHtml(FULL);
    expect(html).toContain("Prix souhaité");
    expect(html).toContain("3500 €");
    expect(html).toContain("48000 km");
    expect(html).toContain("2019");
    expect(html).toContain("MT-07 689");
  });

  test("renders the seller block from the denormalized submitter", () => {
    const html = recapHtml(FULL);
    expect(html).toContain("Moto Sud");
    expect(html).toContain("Durand");
    expect(html).toContain("Claire");
    expect(html).toContain("0601020304");
    expect(html).toContain("claire@moto-sud.fr");
  });

  test("renders the dossier block with French status, région and date", () => {
    const html = recapHtml(FULL);
    expect(html).toContain("En cours");
    expect(html).toContain("Sud");
    expect(html).toContain("3200 €");
    expect(html).toContain("26 juil. 2026 14:30");
  });

  test("prints the back office's own status verbatim", () => {
    // No `viewerStatus` projection: the reader is always the back office.
    expect(recapHtml(dossier({ status: "a_traiter" }))).toContain("À traiter");
  });

  test("reveals the électrique sub-answers only when électrique is oui", () => {
    expect(recapHtml(FULL)).toContain("Batterie présente");
    expect(recapHtml(FULL)).toContain("Chargeur présent");
    const thermique = dossier({
      vehicle: { ...FULL.vehicle, electrique: "non", materiel: [] },
    });
    expect(recapHtml(thermique)).not.toContain("Batterie présente");
  });

  test("reveals the nature de la panne only for a dossier En Panne", () => {
    expect(recapHtml(FULL)).toContain("Démarreur HS");
    const bon = dossier({
      condition: { etat: "Bon état", naturePanne: "Démarreur HS" },
    });
    expect(recapHtml(bon)).not.toContain("Démarreur HS");
  });

  test("reveals the papers sub-answers only when their parent is oui", () => {
    const html = recapHtml(FULL);
    expect(html).toContain("À votre nom");
    expect(html).toContain("Résultat obtenu");
    const sansPapiers = dossier({
      papers: {
        ...FULL.papers,
        carteGrise: "non",
        carteGriseAVotreNom: null,
        controleTechnique: "non",
        ctMoins6Mois: null,
        resultatCT: null,
      },
    });
    const html2 = recapHtml(sansPapiers);
    expect(html2).not.toContain("À votre nom");
    expect(html2).not.toContain("Résultat obtenu");
  });

  test("reveals the key counts only when there are keys", () => {
    expect(recapHtml(FULL)).toContain("Clé noire");
    const sansCles = dossier({
      keys: { ...FULL.keys, aClesContact: "non", cleNoire: null },
    });
    expect(recapHtml(sansCles)).not.toContain("Clé noire");
  });

  test("keeps a zero count but drops an unanswered one", () => {
    // FULL has cleMarron: 0 and cleRouge: null. Zero keys of a colour is an
    // answer; a null is a question the funnel never asked.
    const html = recapHtml(FULL);
    expect(html).toContain("Clé marron");
    expect(html).not.toContain("Clé rouge");
  });

  test("drops a row the funnel never answered", () => {
    const html = recapHtml(
      dossier({
        vehicle: { ...FULL.vehicle, annee: null, kilometrage: null },
        pricing: { prix: null, commentaires: "" },
        validatedPrice: null,
      }),
    );
    expect(html).not.toContain("Année");
    expect(html).not.toContain("Kilométrage");
    expect(html).not.toContain("Prix souhaité");
    expect(html).not.toContain("Prix validé");
    // And no dash ever reaches the page.
    expect(html).not.toContain("—");
  });

  test("escapes free text instead of letting it into the markup", () => {
    const html = recapHtml(
      dossier({ pricing: { prix: 3500, commentaires: "<script>alert(1)</script>" } }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `functions/`): `npx jest src/dossierEmail/render.test.ts`
Expected: FAIL — `Cannot find module './render'`.

- [ ] **Step 3: Write `functions/src/dossierEmail/render.ts`**

```ts
import { section, shell, type Row } from "../emailHtml";
import {
  euros,
  hasMateriel,
  kilometres,
  ouiNon,
  REGION_LABELS,
  STATUS_LABELS,
  submittedAt,
  type DossierStatus,
  type OuiNon,
  type Region,
} from "../labels";

/**
 * The subset of a `dossiers/{id}` document the recap prints — which is all of
 * it bar the photos and the routing fields.
 *
 * `createdAt` is typed structurally rather than as a `Timestamp` so this module
 * needs no Firebase import and stays testable with a plain object.
 */
export interface RecapDossier {
  status: DossierStatus;
  region: Region;
  validatedPrice: number | null;
  createdAt: { toDate(): Date } | null;
  submitter: {
    nom: string;
    prenom: string;
    companyName: string;
    email: string;
    telephone: string;
  };
  vehicle: {
    electrique: OuiNon;
    materiel: string[];
    marque: string;
    modele: string;
    annee: number | null;
    kilometrage: number | null;
    accessoires: string;
  };
  keys: {
    aClesContact: OuiNon | null;
    cleNoire: number | null;
    cleMarron: number | null;
    cleRouge: number | null;
    aTelecommande: OuiNon | null;
    telecommande: number | null;
  };
  condition: { etat: string | null; naturePanne: string };
  papers: {
    carteGrise: OuiNon | null;
    carteGriseAVotreNom: OuiNon | null;
    controleTechnique: OuiNon | null;
    ctMoins6Mois: OuiNon | null;
    resultatCT: string | null;
    certificatNonGage: OuiNon | null;
    carnetEntretien: OuiNon | null;
    factureEntretien: OuiNon | null;
  };
  pricing: { prix: number | null; commentaires: string };
}

/** The dossier screen's collapsibles, flattened: sub-rows only exist when
 *  their parent answer was "oui" — the funnel leaves them null otherwise. */
const when = (answer: string | null | undefined, rows: Row[]): Row[] =>
  answer === "oui" ? rows : [];

/**
 * A number that may be unanswered. `null` — not "—": `rowsHtml` drops a row
 * whose value is empty, and a dash is not empty, so dashing here would print
 * every unanswered field instead of dropping it. `0` still renders, because
 * zero keys of a colour is an answer.
 */
const num = (n: number | null | undefined): string | null =>
  n === null || n === undefined ? null : String(n);

/** "Marque Modèle". */
const vehicleLabel = (d: RecapDossier): string =>
  [d.vehicle.marque, d.vehicle.modele].filter(Boolean).join(" ");

/** The subject, also used as the email's heading. */
export function recapSubject(d: RecapDossier): string {
  return `Demande de rachat - ${d.submitter.companyName} - ${vehicleLabel(d)}`;
}

function intro(d: RecapDossier): string {
  const { prenom, nom, companyName } = d.submitter;
  return (
    "Veuillez trouver le récapitulatif de la demande de rachat soumise dans " +
    `l'application Bike-eco par ${prenom} ${nom}, de ${companyName}.`
  );
}

/**
 * Every row the dossier screen shows, in its order, with the collapsibles
 * flattened. `rowsHtml` drops rows whose value is empty, so an unanswered
 * field simply does not appear.
 */
function vehicleSection(d: RecapDossier): string {
  const { vehicle, keys, condition, papers, pricing } = d;
  return section("Informations véhicule", [
    ["Prix souhaité", pricing.prix === null ? null : euros(pricing.prix)],
    ["Marque", vehicle.marque],
    ["Modèle et Cylindrée", vehicle.modele],
    ["Année", num(vehicle.annee)],
    [
      "Kilométrage",
      vehicle.kilometrage === null ? null : kilometres(vehicle.kilometrage),
    ],
    ["Électrique", ouiNon(vehicle.electrique)],
    ...when(vehicle.electrique, [
      ["Batterie présente", hasMateriel(vehicle.materiel, "batterie") ? "Oui" : "Non"],
      ["Chargeur présent", hasMateriel(vehicle.materiel, "chargeur") ? "Oui" : "Non"],
    ]),
    ["État", condition.etat],
    // Free text, and only ever filled for this one état.
    ["Nature de la panne", condition.etat === "En Panne" ? condition.naturePanne : null],
    ["Carte grise", ouiNon(papers.carteGrise)],
    ...when(papers.carteGrise, [["À votre nom", ouiNon(papers.carteGriseAVotreNom)]]),
    ["Contrôle technique", ouiNon(papers.controleTechnique)],
    ...when(papers.controleTechnique, [
      ["Moins de 6 mois", ouiNon(papers.ctMoins6Mois)],
      ["Résultat obtenu", papers.resultatCT],
    ]),
    ["Certificat de non-gage", ouiNon(papers.certificatNonGage)],
    ["Carnet d'entretien", ouiNon(papers.carnetEntretien)],
    ["Facture d'entretien", ouiNon(papers.factureEntretien)],
    ["Clés de contact", ouiNon(keys.aClesContact)],
    ...when(keys.aClesContact, [
      ["Clé noire", num(keys.cleNoire)],
      ["Clé marron", num(keys.cleMarron)],
      ["Clé rouge", num(keys.cleRouge)],
    ]),
    ["Télécommande ou Bip", ouiNon(keys.aTelecommande)],
    ...when(keys.aTelecommande, [["Nombre", num(keys.telecommande)]]),
    ["Commentaires véhicule", vehicle.accessoires],
    ["Commentaires complémentaires", pricing.commentaires],
  ]);
}

/** Read from the denormalized `submitter`: a deleted colleague's `users/{uid}`
 *  is removed while their dossiers are kept, so this copy is the only value
 *  guaranteed to still exist. */
function sellerSection(d: RecapDossier): string {
  const { submitter } = d;
  return section("Informations vendeur", [
    ["Entreprise", submitter.companyName],
    ["Nom", submitter.nom],
    ["Prénom", submitter.prenom],
    ["Téléphone", submitter.telephone],
    ["Email", submitter.email],
  ]);
}

/** The status is printed raw: `viewerStatus` exists to hide `a_traiter` from a
 *  b2b reader, and this email only ever goes to the back office. */
function dossierSection(d: RecapDossier): string {
  return section("Informations Dossier", [
    ["Date de soumission", d.createdAt === null ? null : submittedAt(d.createdAt)],
    ["Statut", STATUS_LABELS[d.status]],
    ["Prix validé", d.validatedPrice === null ? null : euros(d.validatedPrice)],
    ["Région", REGION_LABELS[d.region]],
  ]);
}

export function recapHtml(d: RecapDossier): string {
  return shell(
    recapSubject(d),
    intro(d),
    vehicleSection(d) + sellerSection(d) + dossierSection(d),
  );
}
```

Note `num()` and the `=== null ? null : …` guards. `euros` and `kilometres` dash an absent number, and "—" is a *non-empty* string that `rowsHtml` renders happily — so calling them unguarded would print every unanswered field as a dash instead of dropping it. Passing `null` is what actually drops a row.

- [ ] **Step 4: Run the tests to verify they pass**

Run (from `functions/`): `npx jest src/dossierEmail/render.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Typecheck and lint**

Run (from `functions/`): `npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/dossierEmail/render.ts functions/src/dossierEmail/render.test.ts
git commit -m "feat(functions): render the dossier recap email"
```

---

### Task 4: The callable's core and schema

Authorization, lookups and error copy — pure, with injected dependencies, exactly as `users/core.ts` does it.

**Files:**
- Create: `functions/src/dossierEmail/schemas.ts`
- Create: `functions/src/dossierEmail/core.ts`
- Test: `functions/src/dossierEmail/core.test.ts`

**Interfaces:**
- Consumes: `RecapDossier`, `recapHtml`, `recapSubject` from `./render` (Task 3); `RegError` and `CallerClaims` from `../errors`.
- Produces:
  - `dossierRecapSchema` and `type DossierRecapInput = { dossierId: string }` from `./schemas`
  - `interface DossierEmailDeps { getDossier(id: string): Promise<RecapDossier | null>; getUserEmail(uid: string): Promise<string | null>; sendMail(mail: { to: string; subject: string; html: string }): Promise<void>; }`
  - `sendDossierRecapCore(input: DossierRecapInput, caller: CallerClaims, deps: DossierEmailDeps): Promise<void>`

- [ ] **Step 1: Write the schema**

Create `functions/src/dossierEmail/schemas.ts`:

```ts
import { z } from "zod";

export const dossierRecapSchema = z.object({
  dossierId: z.string().trim().min(1),
});

export type DossierRecapInput = z.infer<typeof dossierRecapSchema>;
```

- [ ] **Step 2: Write the failing test**

Create `functions/src/dossierEmail/core.test.ts`:

```ts
import { describe, expect, test } from "@jest/globals";
import type { CallerClaims } from "../errors";
import { sendDossierRecapCore, type DossierEmailDeps } from "./core";
import type { RecapDossier } from "./render";

const backoffice: CallerClaims = {
  uid: "bo1",
  role: "backoffice",
  status: "active",
  companyId: null,
};
const dealer: CallerClaims = {
  uid: "b2b1",
  role: "b2b",
  status: "active",
  companyId: "comp_1",
};

const DOSSIER: RecapDossier = {
  status: "en_cours",
  region: "SOUTH",
  validatedPrice: null,
  createdAt: { toDate: () => new Date("2026-07-26T12:30:00Z") },
  submitter: {
    nom: "Durand",
    prenom: "Claire",
    companyName: "Moto Sud",
    email: "claire@moto-sud.fr",
    telephone: "0601020304",
  },
  vehicle: {
    electrique: "non",
    materiel: [],
    marque: "Yamaha",
    modele: "MT-07 689",
    annee: 2019,
    kilometrage: 48000,
    accessoires: "",
  },
  keys: {
    aClesContact: "oui",
    cleNoire: 2,
    cleMarron: null,
    cleRouge: null,
    aTelecommande: "non",
    telecommande: null,
  },
  condition: { etat: "Bon état", naturePanne: "" },
  papers: {
    carteGrise: "oui",
    carteGriseAVotreNom: "oui",
    controleTechnique: "non",
    ctMoins6Mois: null,
    resultatCT: null,
    certificatNonGage: "oui",
    carnetEntretien: "non",
    factureEntretien: "non",
  },
  pricing: { prix: 3500, commentaires: "" },
};

interface Sent {
  to: string;
  subject: string;
  html: string;
}

function fakeDeps(over: Partial<DossierEmailDeps> = {}): DossierEmailDeps & {
  sent: Sent[];
} {
  const sent: Sent[] = [];
  return {
    sent,
    getDossier: async () => DOSSIER,
    getUserEmail: async () => "agent@bike-eco.fr",
    sendMail: async (mail) => {
      sent.push(mail);
    },
    ...over,
  };
}

describe("sendDossierRecapCore", () => {
  test("mails the back-office caller their own address", async () => {
    const d = fakeDeps();
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0].to).toBe("agent@bike-eco.fr");
    expect(d.sent[0].subject).toBe(
      "Demande de rachat - Moto Sud - Yamaha MT-07 689",
    );
    expect(d.sent[0].html).toContain("Informations véhicule");
  });

  test("resolves the recipient from the caller's uid, never from the payload", async () => {
    const seen: string[] = [];
    const d = fakeDeps({
      getUserEmail: async (uid) => {
        seen.push(uid);
        return "agent@bike-eco.fr";
      },
    });
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(seen).toEqual(["bo1"]);
  });

  test("refuses a b2b caller, without sending anything", async () => {
    const d = fakeDeps();
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, dealer, d),
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Action non autorisée.",
    });
    expect(d.sent).toHaveLength(0);
  });

  test("refuses a caller with no role claim at all", async () => {
    const d = fakeDeps();
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, { uid: "x" }, d),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(d.sent).toHaveLength(0);
  });

  test("reports a missing dossier", async () => {
    const d = fakeDeps({ getDossier: async () => null });
    await expect(
      sendDossierRecapCore({ dossierId: "nope" }, backoffice, d),
    ).rejects.toMatchObject({
      code: "not-found",
      message: "Dossier introuvable.",
    });
    expect(d.sent).toHaveLength(0);
  });

  test("reports an account with no email on file", async () => {
    const d = fakeDeps({ getUserEmail: async () => null });
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Aucune adresse email n'est associée à votre compte.",
    });
    expect(d.sent).toHaveLength(0);
  });

  test("treats a blank email as no email", async () => {
    const d = fakeDeps({ getUserEmail: async () => "   " });
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(d.sent).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run (from `functions/`): `npx jest src/dossierEmail/core.test.ts`
Expected: FAIL — `Cannot find module './core'`.

- [ ] **Step 4: Write `functions/src/dossierEmail/core.ts`**

```ts
import { RegError, type CallerClaims } from "../errors";
import { recapHtml, recapSubject, type RecapDossier } from "./render";
import type { DossierRecapInput } from "./schemas";

export interface DossierEmailDeps {
  getDossier(id: string): Promise<RecapDossier | null>;
  /** The caller's own profile email, or null when the account carries none. */
  getUserEmail(uid: string): Promise<string | null>;
  sendMail(mail: { to: string; subject: string; html: string }): Promise<void>;
}

/**
 * Mail the caller a recap of one dossier.
 *
 * Back-office only, and only ever to the caller's own address: the recipient is
 * resolved from the verified claims' uid, never from the payload, so the
 * callable cannot be turned into a way to mail a dossier to a third party.
 *
 * Nothing is persisted and nothing is retried — a failed send leaves no state
 * to reconcile, and the user can simply press the button again.
 */
export async function sendDossierRecapCore(
  input: DossierRecapInput,
  caller: CallerClaims,
  deps: DossierEmailDeps,
): Promise<void> {
  if (caller.role !== "backoffice") {
    throw new RegError("permission-denied", "Action non autorisée.");
  }

  const dossier = await deps.getDossier(input.dossierId);
  if (!dossier) throw new RegError("not-found", "Dossier introuvable.");

  const email = (await deps.getUserEmail(caller.uid))?.trim();
  if (!email) {
    throw new RegError(
      "failed-precondition",
      "Aucune adresse email n'est associée à votre compte.",
    );
  }

  await deps.sendMail({
    to: email,
    subject: recapSubject(dossier),
    html: recapHtml(dossier),
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run (from `functions/`): `npx jest src/dossierEmail/ && npx tsc --noEmit && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/dossierEmail/schemas.ts functions/src/dossierEmail/core.ts functions/src/dossierEmail/core.test.ts
git commit -m "feat(functions): authorize and compose the dossier recap"
```

---

### Task 5: Wire the callable

The only untested layer, by house convention: dependency construction and the `authedCall` wiring.

**Files:**
- Create: `functions/src/dossierEmail/index.ts`
- Modify: `functions/src/email.ts` (add `sendHtmlMail`)
- Modify: `functions/src/index.ts` (re-export the callable)

**Interfaces:**
- Consumes: `sendDossierRecapCore`, `DossierEmailDeps` (Task 4); `dossierRecapSchema` (Task 4); `RecapDossier` (Task 3); `authedCall`, `db` from `../callable`; `B2C_EMAIL_SECRETS` from `../email`.
- Produces: `export const sendDossierRecap` — the deployed callable, named `sendDossierRecap`, which is the string the client passes to `call()` in Task 6.

- [ ] **Step 1: Add `sendHtmlMail` to `functions/src/email.ts`**

Next to the existing `sendMail` (which sends plain text), add:

```ts
/** Reusable HTML sender for non-B2C flows (the back-office dossier recap).
 *  Same pooled transport, same From, same dev override as `sendMail`. */
export async function sendHtmlMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { transport } = getTransport();
  await transport.sendMail({
    from: fromAddress(),
    to: DEV_EMAIL_OVERRIDE ? DEV_EMAIL : opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}
```

- [ ] **Step 2: Write `functions/src/dossierEmail/index.ts`**

```ts
import { authedCall, db } from "../callable";
import { B2C_EMAIL_SECRETS, sendHtmlMail } from "../email";
import { sendDossierRecapCore, type DossierEmailDeps } from "./core";
import type { RecapDossier } from "./render";
import { dossierRecapSchema } from "./schemas";

function dossierEmailDeps(): DossierEmailDeps {
  return {
    // The document is read whole and handed to the renderer as-is: the recap
    // prints every field, so there is nothing to project away.
    getDossier: async (id) => {
      const snap = await db().collection("dossiers").doc(id).get();
      return snap.exists ? (snap.data() as RecapDossier) : null;
    },
    getUserEmail: async (uid) => {
      const snap = await db().collection("users").doc(uid).get();
      return snap.exists ? ((snap.data()!.email as string) ?? null) : null;
    },
    sendMail: sendHtmlMail,
  };
}

/**
 * Mail the calling back-office user a recap of one dossier.
 *
 * Needs the SMTP secrets: `sendHtmlMail` reads them through `.value()`, which
 * only resolves for a function that declared them.
 */
export const sendDossierRecap = authedCall(
  dossierRecapSchema,
  (input, caller) => sendDossierRecapCore(input, caller, dossierEmailDeps()),
  { secrets: B2C_EMAIL_SECRETS },
);
```

- [ ] **Step 3: Re-export from `functions/src/index.ts`**

Add alongside the other callable re-exports, keeping them alphabetical by module:

```ts
export { sendDossierRecap } from "./dossierEmail";
```

- [ ] **Step 4: Verify the whole functions package**

Run (from `functions/`): `npx tsc --noEmit && npm run lint && npm test`
Expected: PASS on all three.

- [ ] **Step 5: Commit**

```bash
git add functions/src/dossierEmail/index.ts functions/src/email.ts functions/src/index.ts
git commit -m "feat(functions): expose the sendDossierRecap callable"
```

---

### Task 6: Client hook

**Files:**
- Create: `src/lib/data/useDossierRecapEmail.ts`

**Interfaces:**
- Consumes: `call` from `./callable`; `useAsyncAction`, `type AsyncActionOptions` from `@/lib/ui/useAsyncAction`; the callable name `"sendDossierRecap"` (Task 5).
- Produces: `useDossierRecapEmail(options?: AsyncActionOptions)` returning `{ sendRecap, pending }`, where `sendRecap(dossierId: string): Promise<{ ok: true } | undefined>` — `undefined` when the call failed or was skipped as re-entrant.

- [ ] **Step 1: Write the hook**

No test: this is a thin wrapper over `call`, and `use*` hooks are gated by `tsc` + lint (see `docs/tech/verification.md`).

```ts
import { call } from "./callable";
import { useAsyncAction, type AsyncActionOptions } from "@/lib/ui/useAsyncAction";

/**
 * Mail the signed-in back-office user a recap of one dossier.
 *
 * Only the id crosses the wire: the callable resolves the recipient from the
 * caller's own token and returns a bare acknowledgement, so the address is
 * never in the client's hands — which is why the confirmation screen says
 * "votre adresse email" rather than naming a mailbox.
 *
 * `call` already maps the failure to French copy, so the default `mapError`
 * is right and callers only pass `onError`.
 */
export function useDossierRecapEmail(options?: AsyncActionOptions) {
  const { run, pending } = useAsyncAction(
    (dossierId: string) =>
      call<{ dossierId: string }, { ok: true }>("sendDossierRecap", {
        dossierId,
      }),
    options,
  );

  return { sendRecap: run, pending };
}
```

- [ ] **Step 2: Typecheck**

Run (from the repo root): `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/useDossierRecapEmail.ts
git commit -m "feat: add the dossier recap email hook"
```

---

### Task 7: Parameterise the back-office confirmation screen

**Files:**
- Modify: `src/app/(backoffice)/confirmation.tsx`

**Interfaces:**
- Consumes: `ConfirmationView` from `@/components/ui/ConfirmationView` (props: `title: string`, `message?: string`, `delay?: number`, `redirectTo: Href`).
- Produces: the route `/(backoffice)/confirmation`, now accepting three optional search params — `title`, `message`, `redirectTo` — each defaulting to the current hardcoded value. Task 8 navigates to it with all three.

- [ ] **Step 1: Rewrite the screen**

The existing call site, `src/app/(backoffice)/dossier/[id]/management.tsx:38`, passes no params and must keep working unchanged — which is exactly what the defaults below guarantee.

```tsx
import { Stack, useLocalSearchParams, type Href } from "expo-router";
import ConfirmationView from "@/components/ui/ConfirmationView";

/**
 * The back office's one confirmation screen.
 *
 * Every field is an optional search param defaulting to the management flow's
 * copy, which is what lets a second flow (the dossier recap email) reuse the
 * route instead of adding a near-identical screen. `useLocalSearchParams`, not
 * the global one: this screen owns these params.
 */
export default function BackofficeConfirmation() {
  const { title, message, redirectTo } = useLocalSearchParams<{
    title?: string;
    message?: string;
    redirectTo?: string;
  }>();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmationView
        title={title ?? "Mis à jour"}
        message={message ?? "Le dossier a bien été mis à jour."}
        delay={1500}
        // Typed routes cannot check a string built at runtime; the cast is the
        // boundary where a param becomes a route.
        redirectTo={(redirectTo ?? "/(backoffice)/(tabs)/dashboard") as Href}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run (from the repo root): `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(backoffice\)/confirmation.tsx
git commit -m "feat: let the back-office confirmation carry its own copy"
```

---

### Task 8: The button on the dossier screen

**Files:**
- Modify: `src/components/screens/DossierDetailScreen.tsx`

**Interfaces:**
- Consumes: `useDossierRecapEmail` (Task 6); the `/(backoffice)/confirmation` params (Task 7); `Button` from `@/components/ui/Button` (props include `label`, `onPress`, `loading`); `alertDialog` from `@/lib/ui/dialog`.
- Produces: nothing downstream. This is the last code task.

- [ ] **Step 1: Add the imports**

At the top of `src/components/screens/DossierDetailScreen.tsx`, alongside the existing imports:

```tsx
import { useRouter } from "expo-router";
import Button from "@/components/ui/Button";
import { useDossierRecapEmail } from "@/lib/data/useDossierRecapEmail";
import { alertDialog } from "@/lib/ui/dialog";
```

- [ ] **Step 2: Add the button component**

Above `LoadedDossier`, add:

```tsx
/**
 * Back-office only: mail myself this dossier.
 *
 * `loading`, not `disabled` — a network round-trip reads as working, not as
 * unavailable. The confirmation names no mailbox because the callable does not
 * return one: it always sends to the caller's own address.
 */
function RecapEmailButton({ id }: { id: string }) {
  const router = useRouter();
  const { sendRecap, pending } = useDossierRecapEmail({
    onError: (message) => alertDialog("Envoi impossible", message),
  });

  return (
    <Button
      label="M'envoyer par email"
      loading={pending}
      onPress={() => {
        void sendRecap(id).then((result) => {
          if (!result) return;
          router.replace({
            pathname: "/(backoffice)/confirmation",
            params: {
              title: "Récapitulatif envoyé",
              message: "Récapitulatif envoyé à votre adresse email",
              redirectTo: `/(backoffice)/dossier/${id}`,
            },
          });
        });
      }}
    />
  );
}
```

- [ ] **Step 3: Render it at the bottom, for the back office only**

In `LoadedDossier`, replace the closing part of the `SectionWrapper` so the button follows the back office's Dossier card:

```tsx
        {role === "backoffice" ? (
          <>
            <DossierCard dossier={dossier} status={status} />
            <RecapEmailButton id={id} />
          </>
        ) : null}
      </SectionWrapper>
```

The B2B branch above it is untouched, so a b2b user gets no button at all.

- [ ] **Step 4: Run the app gate**

Run (from the repo root): `npx tsc --noEmit && npx expo lint && npm test`
Expected: PASS on all three.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/DossierDetailScreen.tsx
git commit -m "feat: mail myself a dossier recap from the back office"
```

---

### Task 9: Sync the specs

`AGENTS.md` requires a spec to be updated in the same change as the feature it describes.

**Files:**
- Modify: `docs/specs/page-dossier.md`
- Modify: `docs/specs/page-confirmation.md`

**Interfaces:** none — documentation only.

- [ ] **Step 1: Document the button in `docs/specs/page-dossier.md`**

In the "Main section", after the paragraph listing the per-role card order (`- **Bike-eco Backoffice** : Informations véhicule, Informations vendeur, Informations Dossier.`), add:

```markdown
### "M'envoyer par email" — back office only

Below the last card, a back-office reader gets a primary button, `M'envoyer par
email`, which mails them a recap of the dossier at the address on their own
account. A b2b user has no such button.

The button spins while the `sendDossierRecap` callable runs. On success the app
goes to [page-confirmation](page-confirmation.md) — "Récapitulatif envoyé" /
"Récapitulatif envoyé à votre adresse email" — which returns to this dossier
after 1.5 s. On failure an alert shows the French error and the reader stays
put.

Only the dossier id is sent: the recipient is resolved server-side from the
caller's own account, so the address is never in the client's hands — which is
why the confirmation says "votre adresse email" instead of naming the mailbox.
The email itself is specified in
[the design doc](../superpowers/specs/2026-08-11-dossier-recap-email-design.md).
```

- [ ] **Step 2: Document the params in `docs/specs/page-confirmation.md`**

Replace the props list with:

```markdown
Confirmation Page props :

- title : mandatory
- message : optional
- delay : default 500ms
- redirection-link : mandatory

The back-office route (`/(backoffice)/confirmation`) takes `title`, `message`
and `redirectTo` as optional search params, each defaulting to the
dossier-management copy ("Mis à jour" / "Le dossier a bien été mis à jour." /
the dashboard). A second flow reuses the route by passing its own three values —
this is how the dossier recap email confirms.
```

- [ ] **Step 3: Commit**

```bash
git add docs/specs/page-dossier.md docs/specs/page-confirmation.md
git commit -m "docs: spec the dossier recap email button"
```

---

### Task 10: Verify end to end against the emulators

Everything above is unit-tested or typechecked. This confirms the pieces meet.

**Files:** none.

- [ ] **Step 1: Start the emulators**

```bash
export JAVA_HOME=/usr/local/jdk-26.0.1
export PATH="$JAVA_HOME/bin:$PATH"
npx firebase-tools@latest emulators:start
```

The SMTP secrets are absent locally, so `getTransport()` falls back to the JSON transport: emails are logged, not sent. That is the intended dev behaviour.

- [ ] **Step 2: Send a recap from the app**

Sign in as a back-office account, open any dossier, and tap `M'envoyer par email`.

Expected:
1. The button spins.
2. The confirmation screen shows "Récapitulatif envoyé" and "Récapitulatif envoyé à votre adresse email".
3. After ~1.5 s the app is back on the same dossier.
4. The functions emulator logs `Email (dev/JSON transport)` — or, for this sender, the composed message — with the subject `Demande de rachat - <entreprise> - <marque> <modèle>`.

- [ ] **Step 3: Check the rendered email**

Copy the logged HTML into a file and open it in a browser. Confirm: the three section headings, the intro sentence naming the seller and their company, the submission date in Paris time, and no row reading "—" or "null".

- [ ] **Step 4: Check the b2b side**

Sign in as a b2b account and open one of that company's dossiers. Expected: no `M'envoyer par email` button anywhere on the screen.

- [ ] **Step 5: Run the full gate one last time**

```bash
cd functions && npx tsc --noEmit && npm run lint && npm test && cd ..
npx tsc --noEmit && npx expo lint && npm test
```

Expected: PASS everywhere.

- [ ] **Step 6: Commit anything outstanding**

```bash
git status   # expect a clean tree; commit any stragglers
```

---

## Out of scope

Do not build these, even if they seem natural:

- B2B users sending themselves a recap.
- Sending to any address other than the caller's own.
- Photos, attached or linked.
- Rate limiting — the callable is back-office-only and can only mail the caller's own mailbox.
- App Check on this callable. It is tracked project-wide in the launch-hardening list and belongs to that change, not this one.
