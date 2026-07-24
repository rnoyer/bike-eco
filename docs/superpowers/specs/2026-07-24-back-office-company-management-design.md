# Slice 4b — Back-office company management (design)

**Date:** 2026-07-24 · **Branch:** `feat/back-office-validation-UI` · **Status:** Approved (brainstorm)

## Context

Slice 4 (registration) was decomposed into three sub-projects:

- **4a — Registration** (shipped, PR #9): company signup, invite-a-colleague, invited
  signup. `registerCompany` creates a `pending` company + owner account; the pending gate
  (Slice 1) blocks them from the dashboard.
- **4b — Back-office company management** *(this spec)*: the pending→active validation
  loop and the destructive delete of an established company.
- **4c — Message `senderName` stamping** (FR-2): independent, small. Its own spec later.

Today nothing flips a `pending` company to `active` except the invited-member flow, and
there is no back-office UI to review applicants. 4b closes that loop.

The UI is already specced: `page-dashboard.md` (pending banner), `page-list-companies.md`
(list), `page-company.md` (detail + approve/decline/delete), `component-card-company.md`
(card), `page-settings.md` (back-office settings). 4b implements them plus the backend
they require.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | 4b scope | **Full `page-company`** — the pending validation loop **and** the irreversible cascade-delete of an active company (users + dossiers + chats + Storage). |
| 2 | Decline semantics | **Hard-delete** the applicant (company doc + owner user doc + Auth user). Frees the SIRET for re-registration. `"rejected"` in `COMPANY_STATUSES` becomes vestigial → trimmed to `["pending", "active"]`. |
| 3 | State-change emails | **Approve only** — "compte validé, vous pouvez vous connecter". Decline is silent. |
| 4 | Company region | **Captured at registration, derived-and-stored.** A "Département" field is added to step 1 of company registration; `company.region` is derived from it (`functions/src/regions.ts`) and stored. Filters the back-office list/banner. |
| 5 | Décliner vs Supprimer | **One `deleteCompany` callable** serves both — the server operation (hard-delete cascade) is identical; pending simply has less to remove. |
| 6 | Region filtering of companies | **Client-side** — companies are a small set, so filter the pending/active lists by `région gérée` in the hook. Avoids region composite indexes (two simple `status+orderBy` composites suffice). |

## Goals

- A back-office user reviews a **pending** applicant and either **approves** (company +
  owner user + claims flip to `active`, applicant emailed) or **declines** (hard-delete).
- A back-office user can **delete an established (`active`) company** and its entire data
  footprint (users + Auth users + dossiers + message subcollections + Storage objects),
  behind a confirmation modal.
- The back-office dashboard shows a **pending banner**; the companies list is reachable
  from the banner and from a Paramètres button.

## Non-goals (deferred)

- Message `senderName` server-stamping (FR-2) — **4c**.
- Any per-user (rather than per-company) management, role changes, or re-invitation.
- Undo/restore of a deleted company (hard-delete is final by design).

## Architecture

### 1. Cloud Functions (`functions/src/registration`, 2nd-gen `onCall`)

Mirror the 4a pattern: a thin `onCall` wrapper (auth + payload validation + error mapping)
over a pure `core.ts` function with an injected `Deps` interface, unit-tested without the
emulator. Both callables require the caller to be an **active back-office** user
(`claims.role === "backoffice"`, `claims.status === "active"`).

1. **`approveCompany({ companyId })`**
   - Loads the company; it **must be `pending`** (else `failed-precondition`).
   - Sets `company.status = "active"`, `company.validatedAt = serverTimestamp()`.
   - Flips the owner: the user doc(s) with `companyId == companyId` → `status = "active"`,
     `updatedAt`; and `setCustomUserClaims(uid, { role: "b2b", companyId, status: "active" })`
     (role/companyId unchanged). A pending company has exactly one user (invited members
     only ever join active companies), but the function flips **all** `pending` users of
     that company defensively.
   - `sendApprovalEmail(ownerEmail, companyName)`.
   - Returns `{ ok: true }`.

2. **`deleteCompany({ companyId })`** — the hard-delete cascade, used by **both** "Décliner"
   (pending) and "Supprimer cette entreprise" (active):
   1. `bucket.deleteFiles({ prefix: `dossiers/${companyId}/` })` — every photo, thumbnail,
      and message attachment (Storage is company-prefixed: `dossiers/{companyId}/...`).
   2. `dossiers where companyId == companyId` → `firestore.recursiveDelete(dossierRef)` each
      (removes the `messages` subcollection too).
   3. `users where companyId == companyId` → delete the Firestore doc **and** the Auth user
      (`admin.auth().deleteUser(uid)`).
   4. Delete the company doc → frees the SIRET.
   - Returns `{ ok: true }`. Idempotent-ish: re-running on an already-deleted company is a
     no-op cascade.

No security-rules change: `companies` is `allow write: if false`, so both callables run via
the Admin SDK (which bypasses rules), exactly like 4a.

### 2. Data model (`src/lib/firestore/schema.ts` + functions)

`Company` gains:

```ts
departement: string;              // "33 - Gironde" — captured at registration (step 1)
region: Region;                   // derived from departement; drives back-office routing
validatedAt: Timestamp | null;    // set on approve; null while pending
createdByName: string;            // denormalized owner full name for the card subtitle
```

- `COMPANY_STATUSES` trimmed to `["pending", "active"]`.
- `createdByName` avoids an N+1 read per company card (the card subtitle is the owner's full
  name — `page-list-companies` / `component-card-company`).

### 3. Company registration change (touches 4a form + `registerCompanyCore`)

Per Decision 4, region is captured at the source rather than derived from a profile field:

- **`form-b2b-company-registration` step 1** ("Coordonnées Entreprise") gains a mandatory
  **"Département\*"** dropdown (same France-métropolitaine list as step 3 —
  `src/constants/departments.ts`), after "Nom de votre entreprise".
- **Step 3** ("Vos coordonnées") user "Département" **pre-fills** from the step-1 value
  (still editable — the registrant may live outside the company's département).
- The Zod schema and `RegisterCompanyInput` gain the company `departement`.
- **`registerCompanyCore`** writes `company.departement`, `company.region =
  resolveRegion(departement)` (reuse `functions/src/regions.ts`), `validatedAt: null`,
  and `createdByName = `${prenom} ${nom}``.
- **Seed script** (`scripts/seed.ts`, from Slice 1) updated so existing test companies carry
  `departement`/`region`/`validatedAt`/`createdByName` — no standalone backfill script (dev
  data is re-seeded).

### 4. Data layer (`src/lib/data/`)

- **`useCompanies(status, regionFilter)`** — `onSnapshot` on `companiesRef` `where status ==`,
  ordered `createdAt asc` for `pending` (older on top) / `validatedAt desc` for `active`
  (most-recent validation on top). Returns `WithId<Company>[]`. Region filter applied
  **client-side** (Decision 6).
- **Pending count** for the banner = `useCompanies("pending", region).data.length`.
- Two composite indexes in `firestore.indexes.json`: `companies (status ASC, createdAt ASC)`
  and `companies (status ASC, validatedAt DESC)`.
- **Client callable wrappers** (`approveCompany`, `deleteCompany`) with French error mapping,
  mirroring 4a's `submitCompanyRegistration` helpers.

### 5. Client screens & navigation (`src/app/(backoffice)/` + components)

- **Pending banner** — in the back-office branch of `DashboardScreen`: when the pending count
  > 0, a sticky, clickable banner "**[X] nouveaux vendeurs à valider**" → push
  `/(backoffice)/companies`.
- **Paramètres button** — a secondary **"Gérer les entreprises"** button in the back-office
  settings screen (above "Région gérée") → `/(backoffice)/companies`.
- **`(backoffice)/companies/index.tsx`** — reuses the dashboard layout: two sections via a
  `CompaniesSection` (mirrors `DossiersSection`) with `CompanyCard` (mirrors `DossierCard`;
  title = company name, subtitle = `createdByName`, right = "Gérer" → detail):
  - "Vendeurs à valider" (pending, older on top) — empty: "Pas de vendeur a valider pour le
    moment."
  - "Vendeurs enregistrées" (active, most-recent validation on top) — empty: "Pas de vendeur
    enregistrée pour le moment."
- **`(backoffice)/companies/[id].tsx`** — scrollable detail:
  - **If pending:** "Voulez-vous autoriser cette entreprise à vendre des véhicules" with
    `Autoriser` (→ `approveCompany`) and `Décliner inscription` (confirm → `deleteCompany`).
  - "Information vendeur" — compact label/value list of the company (name, SIRET, département,
    créée le).
  - "Information vendeur admin" — compact label/value list of the owner user (nom, prénom,
    email, téléphone, département, ville).
  - **If approved:** "Autres utilisateurs de cette entreprise" — list of the company's users;
    and a red "Supprimer cette entreprise" → **confirmation modal** (warns what is deleted;
    primary "Annuler", secondary "Supprimer tout") → `deleteCompany`.
  - On approve/decline/delete success, pop back to the list — the live `useCompanies`
    listener reflects the change (company moves sections or disappears).

### 6. Emails (`functions/src/registration/emails.ts`)

Add `sendApprovalEmail(to, companyName)` — "Votre compte vendeur a été validé, vous pouvez
vous connecter." — reusing the existing SMTP secrets / `DEV_EMAIL_OVERRIDE` setup. Decline
sends nothing (Decision 3).

## Testing

- **Core units** (injected `Deps`, no emulator):
  - `approveCompanyCore` flips company + user + claims, sends the email, rejects a
    non-`pending` company and a non-back-office caller.
  - `deleteCompanyCore` invokes each teardown dep (Storage prefix, dossiers recursive-delete,
    users + Auth delete, company delete) in order; rejects a non-back-office caller.
  - `resolveRegion` mapping (already covered by `regions.ts` tests — extend if needed).
- **Emulator integration** (Auth + Firestore + Storage):
  - `approveCompany` end-to-end: `pending`→`active`, `validatedAt` set, user status + claims
    flipped.
  - `deleteCompany` cascade: seed company + user + dossier + message + a storage object, run,
    assert all four tiers are gone and the Auth user is deleted.
  - A b2b (non-back-office) caller is denied both callables.
- **Interactive walkthrough** (seeded pending + active companies): banner appears → approve
  activates and emails → decline removes → delete-active cascades.

## Owner manual setup

1. Deploy the two callables + the new approval email (`firebase deploy --only functions`).
2. Deploy the two composite indexes (`firebase deploy --only firestore:indexes`).
3. Re-run the updated seed script so existing test companies carry the new fields.
4. **Launch hardening:** add App Check enforcement to `approveCompany` / `deleteCompany`
   alongside the 4a callables — see `launch-hardening-todo`.

## Spec sync (kept in sync in the implementing change)

- `docs/specs/form-b2b-company-registration.md` — step-1 "Département" field + step-3 prefill.
- `docs/specs/page-settings.md` — back-office "Gérer les entreprises" button.
- `docs/specs/page-company.md` — note that Décliner and Supprimer share one `deleteCompany`
  callable.
- The schema doc / `schema.ts` comments — new `Company` fields and trimmed statuses.
