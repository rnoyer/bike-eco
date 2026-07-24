# Location model simplification — `département` / `ville` / `région` (design)

**Date:** 2026-07-24 · **Branch:** `feat/back-office-validation-UI` (follow-up to Slice 4b, pre-merge) · **Status:** Approved (brainstorm)

## Context

Location is currently modelled redundantly across three places:

- **`AppUser`** carries `region` (always `null` for b2b; never set by registration), `departement`, and `ville`.
- **`Company`** carries `departement` + derived `region` (added in Slice 4b) but no `ville`.
- **`Dossier.region`** is derived **client-side** in `toDossier.ts` from `session.departement` (the *user's* département), not the company's.

Audit findings (verified):
- `claims.region` / `user.region` is **never set for b2b** and used nowhere — the dossier region uses *département*, and the back-office "Région gérée" filter is a **separate local device preference** (`region-store` / `useRegionFilter`), not a user claim.
- `user.departement` is used only by the dossier region derivation; `user.ville` only by `AccountInfoList` display.
- The B2B submission flow **already loads the company doc** (`submit.ts` — for the company name), so deriving the dossier region from `company.departement` needs no extra read.
- The B2C public funnel keeps its own `departement`/`ville` (separate, email-only payload) — out of scope.

This change makes the **company** the single source of truth for location and removes location from the user entirely.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | `AppUser` location | **Drop all three** (`region`, `departement`, `ville`). A user has no location; the company does. |
| 2 | Back-office region routing | **Keep the local "Région gérée" device preference** unchanged; **remove `region` from `AppUser` and Auth claims** entirely (it was unused). |
| 3 | b2b "Mon compte" screen | **Two sections:** "Mon compte" (personal) + "Informations [company name]" (company). BO account = "Mon compte" only (no company). |
| 4 | Migration | **Not live yet → re-seed only.** No Admin-SDK migration script. |
| 5 | Région on the b2b account view | **Omit** — Région is back-office routing, noise for a dealer. Shown only in the back-office `CompanyInfoList`. |

## Target data model

**`AppUser`** (`src/lib/firestore/schema.ts`):
```ts
export interface AppUser {
  role: UserRole;
  companyId: string | null;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  status: UserStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```
Removed: `region`, `departement`, `ville`.

**`Company`** gains `ville`:
```ts
departement: string;   // "33 - Gironde"
ville: string;         // NEW
region: Region;        // derived from departement
```

**`Dossier`** — shape unchanged. `region` is now derived from `company.departement` at creation (still BO-editable via the management form).

**Auth claims / session** (`src/lib/auth/session.ts`):
- `AuthClaims` drops `region`; `parseClaims` stops reading it; `buildSessionUser` stops setting it.
- `SessionUser = WithId<AppUser>` automatically loses `region`/`departement`/`ville`.
- The `Region` type stays (used by `Dossier`, `Company`, and the region filter). `region-store` / `useRegionFilter` / `regionOptions` are **untouched**.

## Registration changes

### Company signup (`form-b2b-company-registration`)
- **Step 1** ("Coordonnées Entreprise"): SIRET + Nom + **Département** + **Ville**. (Département was added in 4b; Ville is new here.)
- **Coordonnées step**: nom / prénom / téléphone only (drop département + ville). The step-1→step-3 département **prefill effect is removed** (`register.tsx`).
- The shared **`CoordonneesFields`** (`src/features/registration/fields.tsx`) becomes nom / prénom / téléphone (used by both company + invited flows).
- Client form schema (`b2b-registration/schema.ts`): add `companyVille`, drop user `departement`/`ville`; `companyDepartement` + `companyVille` are required.
- Payload (`RegisterCompanyPayload`) + `submit.ts` / `register.tsx`: send `siret, companyName, companyDepartement, companyVille, nom, prenom, telephone`.

### Invited signup (`form-b2b-invited-registration`)
- Coordonnées step drops département + ville → nom / prénom / téléphone (the company already holds the location).
- `b2b-invited-registration/schema.ts` + `submit.ts` trimmed accordingly.

### Cloud Functions (`functions/src/registration`)
- **`schemas.ts`**: shared `profile` drops `departement`/`ville` → `{ nom, prenom, telephone }`. `registerCompanySchema` requires `companyDepartement` + `companyVille` (no longer optional). `acceptInviteSchema` profile trimmed.
- **`core.ts`** `profileDoc`: user doc = `{ role, companyId, nom, prenom, email, telephone, status }` — no `region`/`departement`/`ville`. `registerCompanyCore` writes `company.ville` (and `departement`/`region` from `companyDepartement` as today); drop the `companyDepartement ?? departement` fallback (both are now required company fields).
- Update `core.test.ts` assertions (user doc no longer has location; company doc gains `ville`).

## Dossier creation (`b2b-submission/toDossier.ts`)
- `toDossierPayload(values, session, company, photos)` — `company` param gains `departement`; `region: regionForDepartement(company.departement)`.
- `submit.ts`: read `companySnap.data()?.departement` and pass it in `{ id, name, departement }`.
- Update `toDossier.test.ts` (region now sourced from the company arg, not `session.departement`).

## Screens

### `AccountScreen` (`src/components/screens/AccountScreen.tsx`)
- **b2b:** two sections — "Mon compte" (`AccountInfoList`) + "Informations [company name]" (company location), the company loaded via `useCompany(session.companyId)`.
- **back-office:** "Mon compte" only (BO has no `companyId`).

### `AccountInfoList` (`src/components/native/AccountInfoList.tsx`)
- Trimmed to personal rows: Nom, Prénom, Email, Téléphone. Drops Département / Ville / Région (also removes the back-office Région branch). Still reused in the BO company-detail owner section (company location shows there under "Information vendeur").

### `CompanyInfoList` (`src/components/native/CompanyInfoList.tsx`)
- Gains a **Ville** row.
- Context-aware rows so it serves both consumers: back-office company detail shows Entreprise (name) + SIRET + Département + Ville + Région; the b2b account section shows SIRET + Département + Ville (name is in the section title; **no Région**). Implement via two boolean props (e.g. `showName`, `showRegion`, both defaulting to the back-office view).

## Rules / seed / specs

- **`firestore.rules`**: dossier `region in ['NORTH','SOUTH']` create/update rule **unchanged**. The users-update forbidden-keys list drops `'region'` (the field no longer exists) → `['role', 'companyId', 'status', 'createdAt']`.
- **`scripts/seed.ts`**: add `ville` to every company; drop `region`/`departement`/`ville` from every user doc and the back-office `region` claim.
- **No migration script** (not live).
- **Spec sync (same change):** `schema.ts` comments; `docs/specs/form-b2b-company-registration.md` (step-1 Ville, coordonnées drops location + no prefill); `docs/specs/form-b2b-invited-registration.md` (coordonnées drops location); `docs/specs/page-my-account.md` (two sections); `docs/specs/page-company.md` (owner section = personal only; company section carries Département + Ville); and the 4b design doc's data-model note.

## Out of scope
- B2C public funnel location fields (separate email-only payload).
- The "Région gérée" back-office filter mechanism (kept as-is).
- Any Auth-claims migration for existing users (not live).
