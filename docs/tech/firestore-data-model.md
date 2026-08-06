# Firestore data model

The Bike-eco Firestore data model: target database, collections, schema, access
patterns, and the build roadmap. The authoritative types live in
`src/lib/firestore/schema.ts` (typed refs in `src/lib/firestore/collections.ts`);
keep this document in sync when the model changes.

## Key decisions

- **Database:** app data lives in the named **`bike-eco-db`** database (Standard
  edition), not `(default)`. Initialized in `firebaseConfig.ts` via
  `getFirestore(app, "bike-eco-db")`.
- **B2C is email-only:** the public (non-logged-in) B2C funnel does **not** write
  to Firestore. A Cloud Function validates the submission and sends the two
  summary emails routed NORTH/SOUTH (→ `romain.noyer@gmail.com` in dev). Because
  there is no unauthenticated write path, **every Firestore rule can require
  auth**. As a result, `dossiers` are **B2B only**.
- **RBAC via custom claims:** `role`, `companyId`, and account `status` are
  server-set (Auth custom claims), never client-writable. The `users` document
  mirrors these for display; rules trust the claim, not the document.

## Build roadmap

| # | Step | Status |
|---|------|--------|
| 1 | `getFirestore(app, "bike-eco-db")` in `firebaseConfig.ts` | ✅ done |
| 2 | Firebase Auth (email/password + Google) + custom claims (`role`, `companyId`) | todo |
| 3 | Schema-as-code: TS interfaces + converter-backed refs | ✅ done |
| 4 | `firestore` block in `firebase.json` → `firestore.rules` + `firestore.indexes.json` | todo |
| 5 | Security rules — default-deny, role/ownership + per-collection validators (incl. devil's-advocate pass) | todo |
| 6 | Cloud Functions: B2C email-only, B2B invitation, onDossierCreate notify, company/user validation | todo |
| 7 | Composite indexes (see [Indexes](#query-patterns--indexes)) | todo |
| 8 | Emulator validation + app integration (dashboard queries, dossier page, chat) | todo |

## Collections

```
companies/{companyId}
users/{uid}
invitations/{invitationId}
dossiers/{dossierId}                      (B2B only)
dossiers/{dossierId}/messages/{messageId}
```

Dates are `timestamp`; numeric vehicle values (`prix`, `annee`, `kilometrage`,
`cylindree`) are `number` (converted from the funnel's string inputs on submit).

### `companies/{companyId}`

| field | type | notes |
|-------|------|-------|
| `siret` | string | 14 digits, immutable |
| `name` | string | |
| `status` | string | `pending` → `active` (manual validation by the team; a declined applicant is hard-deleted, so there is no persisted `rejected`) |
| `departement` | string | company location, e.g. `"33 - Gironde"` — captured at registration |
| `ville` | string | company city |
| `region` | string | `NORTH` \| `SOUTH`, derived from `departement` — drives back-office routing |
| `createdBy` | uid | first registrant |
| `createdByName` | string | denormalized `"prénom nom"` of the first registrant (company card subtitle) |
| `validatedAt` | timestamp \| null | set when the team approves; `null` while pending |
| `createdAt` | timestamp | immutable |

**Location lives only on the company** — a `users` document has no `departement`/`ville`/`region`. A dossier's `region` is derived from its company's `departement`.

### `users/{uid}`

Contains PII → readable by the owner, the Bike-eco team, and an active teammate sharing
the same `companyId`.

| field | type | notes |
|-------|------|-------|
| `role` | string | `b2b` \| `backoffice` — mirror of the custom claim, server-set |
| `companyId` | string \| null | b2b only |
| `isAdmin` | boolean | server-set, never client-writable, **not** mirrored into custom claims. `true` for the user who registered the company and for back-office accounts, `false` for an invited colleague. An admin manages their team (promote/delete a colleague) and cannot be deleted, including from their own "Supprimer mon compte". |
| `nom`, `prenom` | string | |
| `email`, `telephone` | string | PII |
| `status` | string | `pending` until the company is validated → `active` |
| `createdAt`, `updatedAt` | timestamp | |

A user carries **no location** — `departement`/`ville`/`region` live on the company. The Auth custom claims are `role` / `companyId` / `status` only (no `region`); the back-office "Région gérée" is a local device preference, not a claim.

### `invitations/{invitationId}`

| field | type | notes |
|-------|------|-------|
| `email` | string | invitee |
| `role` | string | `b2b` \| `backoffice` — the role the invitee will be given |
| `companyId` | string \| null | the inviter's company; **null** for a back-office invitation |
| `invitedBy` | uid | |
| `tokenHash` | string | store a hash, never the raw token |
| `status` | string | `pending` \| `accepted` \| `expired` |
| `expiresAt` | timestamp | one-time, time-limited |
| `createdAt` | timestamp | |

### `dossiers/{dossierId}`

B2B only. Form sections are grouped into nested maps for readability.

| field | type | notes |
|-------|------|-------|
| `status` | string | `a_traiter` \| `en_cours` \| `cloture` |
| `region` | string | `NORTH` \| `SOUTH`, derived from the submitter's **company** `departement` (reuses `isNord`/`isSud`); reassignable by the back-office (page-dossier-management) |
| `companyId` | string | owner company |
| `submittedBy` | uid | |
| `negotiatedPrice` | number \| null | back-office deal outcome (page-dossier-management) |
| `submitter` | map | denormalized display: `{ nom, prenom, companyName }` (for cards/chat) |
| `vehicle` | map | see below |
| `keys` | map | see below |
| `condition` | map | see below |
| `papers` | map | see below |
| `pricing` | map | see below |
| `photos` | string[] | Storage download URLs |
| `thumbnailUrl` | string \| null | low-res first photo (card spec) |
| `createdAt`, `updatedAt` | timestamp | `createdAt` orders the dashboards |

**`vehicle`**

| field | type | notes |
|-------|------|-------|
| `electrique` | `"oui"` \| `"non"` | |
| `materiel` | string[] | e.g. "J'ai la batterie", "J'ai le chargeur" |
| `marque` | string | |
| `modele` | string | B2B merges "Modèle et Cylindrée" into this field |
| `cylindree` | number \| null | |
| `annee` | number \| null | |
| `kilometrage` | number \| null | |
| `accessoires` | string | |

**`keys`**

| field | type |
|-------|------|
| `aClesContact` | `"oui"` \| `"non"` \| null |
| `cleNoire`, `cleMarron`, `cleRouge` | number \| null |
| `aTelecommande` | `"oui"` \| `"non"` \| null |
| `telecommande` | number \| null |

**`condition`**

| field | type | notes |
|-------|------|-------|
| `etat` | enum \| null | `Bon état` \| `En Panne` \| `Fort kilométrage` \| `Refus au Contrôle Technique` \| `Mauvais Etat` \| `Accidenté` |
| `naturePanne` | string | |

**`papers`**

| field | type |
|-------|------|
| `carteGrise`, `carteGriseAVotreNom` | `"oui"` \| `"non"` \| null |
| `controleTechnique`, `ctMoins6Mois` | `"oui"` \| `"non"` \| null |
| `resultatCT` | `"Favorable"` \| `"Défavorable"` \| null |
| `certificatNonGage` | `"oui"` \| `"non"` \| null |
| `carnetEntretien`, `factureEntretien` | `"oui"` \| `"non"` \| null |

**`pricing`**

| field | type | notes |
|-------|------|-------|
| `prix` | number \| null | seller's asking price (from the submission) |
| `commentaires` | string | |

### `dossiers/{dossierId}/messages/{messageId}`

One chat per dossier, between the B2B company members and the Bike-eco team.

| field | type | notes |
|-------|------|-------|
| `senderId` | uid | |
| `senderName` | string | denormalized: `"[name] - [company]"` or `"[name] - Bike-eco"` |
| `senderRole` | string | `b2b` \| `backoffice` |
| `text` | string | |
| `attachments` | array&lt;map&gt; | `{ type: "image" \| "pdf", url, name, size }` |
| `createdAt` | timestamp | orders the thread |

## Status → dashboard mapping

`status` drives the three dashboards:

- **Back office** splits `a_traiter` / `en_cours` / `cloture` into three sections.
- **B2B "Dossiers en cours"** = `status in ['a_traiter', 'en_cours']`.
- **B2B "Dossiers clos"** = `cloture`.

## Storage layout

Photos and chat attachments live in Cloud Storage:

```
dossiers/{dossierId}/photos/*
dossiers/{dossierId}/chat/*
```

## Query patterns → indexes

Single-field indexes are automatic in Standard edition. The dashboard queries
need two composite indexes:

| Query | Index |
|-------|-------|
| B2B dashboard: `where(companyId ==) + where(status in) + orderBy(createdAt desc)` | `(companyId, status, createdAt)` |
| Back office: `where(region ==) + where(status ==) + orderBy(createdAt desc)` | `(region, status, createdAt)` |
| Chat: `messages orderBy(createdAt)` | automatic (single-field) |

## Access control (summary)

- **dossiers** — read: B2B users where `companyId` matches their claim; team where
  `region` matches. Create: B2B authed user. Update: team (status transitions +
  `negotiatedPrice`), always combined with field validation — never
  ownership-only.
- **companies / users** — a `users/{uid}` document is readable by its owner, the
  back-office team, and an active teammate sharing the same `companyId` (so "Mes
  collaborateurs" and the company page's user cards can read colleagues' PII).
  `role` / `companyId` / `status` / `isAdmin` are server-set only, and all four sit
  on the client-update denylist.
- **invitations / messages** — scoped to the company members and team involved.
