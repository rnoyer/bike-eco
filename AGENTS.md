# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Zod (v4) documentation

When working with Zod or answering questions about it, use the `inkeepMcp` MCP tools:
- **Zod (v4) Documentation Search** — search Zod's documentation, GitHub issues, release notes, and help center.
- **Ask Zod (v4) Expert** — ask specific questions about Zod's APIs or implementation details.

# Project docs

These specs are the source of truth for product behavior, page layout, components, and
form structure. Read the relevant file **before** building or editing the corresponding
feature. Keep a spec in sync in the same change that alters its feature.

- **Product overview** — `docs/product/bike-eco-app.md`: the three paths (B2C public
  funnel, B2B dealer dashboard, Bike-eco back office), plus the chat and dossier
  features. Read this first for context on any feature work.

- **Form specs** (`docs/specs/`) — exact step/field/validation definitions. Read the
  matching file before implementing or changing any form or its validation:
  - `form-b2c-vehicule-submission.md` — public (non-logged-in) B2C vehicle submission funnel.
  - `form-b2b-vehicule-submission.md` — logged-in B2B "Vendre une moto" submission form.
  - `form-b2b-company-registration.md` — B2B company signup (SIRET + company, account, contact).
  - `form-b2b-invited-registration.md` — invited team-member registration (prefilled disabled email; 3 steps).

- **Page specs** (`docs/specs/`) — navbar/main/tab-bar layout per screen. Read the
  matching file before building or editing a page:
  - `page-login-signup.md` — B2B/back-office login front page (sign-in form + third-party auth).
  - `page-dashboard.md` — B2B and back-office dashboard with dossier sections (differs by role).
  - `page-dossier.md` — dossier detail (compact label/value list of the vehicle's form data).
  - `page-dossier-management.md` — back-office status + negotiated-price update (status dropdown, prix, "Mettre à jour").
  - `page-chat.md` — per-dossier messaging with file (pdf/photo) attachments.
  - `page-my-account.md` — user account info screen.
  - `page-settings.md` — settings (invite a colleague, delete account).
  - `page-add-colleague.md` — invite a colleague by email.
  - `page-confirmation.md` — generic success screen with delayed auto-redirect (title/message/delay/redirection-link props).
  - `page-colleague.md` — one colleague: info, and (admin only) promote/demote + delete.

- **Component specs** (`docs/specs/`) — shared UI building blocks. Read the matching
  file before building or editing a component:
  - `component-info-card.md` — the read-only information card (dark title bar + parts:
    liste d'information, contact row with action button, comments). Every label/value
    block in the app is one of these.
  - `component-navbar.md` — top navbar (left / middle / right props).
  - `component-tab-bar.md` — bottom tab bar (always visible, per-page links).
  - `component-card-dossier.md` — thin wide dossier card (thumbnail, title, subtitle).
  - `component-dossiers-section.md` — titled list of dossiers (per-section fetch, loading + empty states).
  - `component-card-colleague.md` — colleague card (title/subtitle/optional action button).

- **Runbooks** (`docs/ops/`) — operational procedures against the live project:
  - `first-backoffice-account.md` — creating a `backoffice` account on `bike-eco-43a84`
    with `scripts/grant-backoffice.js` (Auth user + custom claims + `users/{uid}` doc).
    No product path creates one.
  - `manage-accounts.md` — creating a b2b account (`scripts/create-b2b.js`, optionally
    with its company) and fully erasing one, split by role and dry-run by default:
    `scripts/delete-b2b-user.js` (Auth, profile, dossiers, Storage files, invitations)
    and `scripts/delete-backoffice.js` (Auth + profile; refuses the last active one).

# Project skills

Five skills carry this project's conventions, one per layer. **Activate the matching one
before working in that layer** — each holds the non-obvious rules and the mistakes that
break things, and each is kept in sync with the code it describes.

| Skill | Activate when touching |
|---|---|
| `bike-eco-forms` | Any form: funnels, single-step screens, Zod schemas, fields, submit handlers |
| `bike-eco-auth` | Sign-in/up/out, passwords, claims, route guards, third-party providers |
| `bike-eco-ui` | Screens, components, info lists, cards, badges, modals, tokens/styling |
| `bike-eco-data` | Firestore queries, `use*` hooks, the data model, rules, indexes |
| `bike-eco-functions` | Anything in `functions/` — callables, payload validation, email |

Also activate the `firebase-firestore` skill when designing or changing data.

# Verification

`docs/tech/verification.md` is the single source for how a change is gated: the
`tsc` + lint + test command, what is unit-tested and what isn't, the security-rules tests,
and the typed-routes regeneration step required after adding a route file.

# Data / Firestore facts

- App data lives in the **named `bike-eco-db`** database (Standard edition), not
  `(default)`. The client is initialized in `firebaseConfig.ts` (`db`, `storage`, `app`).
- The data model is typed in `src/lib/firestore/schema.ts` (collections: `companies`,
  `users`, `invitations`, `dossiers`, `dossiers/*/messages`) with typed, converter-backed
  refs in `src/lib/firestore/collections.ts`. Keep these in sync when the model changes.
- `dossiers` are **B2B only** — the public B2C funnel is email-only (a Cloud Function
  sends the NORTH/SOUTH summary emails; nothing is persisted).
- `role` / `companyId` / account `status` are server-set (Auth custom claims), never
  client-writable. `isAdmin` is also server-set (but lives only on the `users/{uid}`
  document, not in claims). Security rules are default-deny and require auth.
