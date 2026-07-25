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

- **Component specs** (`docs/specs/`) — shared UI building blocks. Read the matching
  file before building or editing a component:
  - `component-navbar.md` — top navbar (left / middle / right props).
  - `component-tab-bar.md` — bottom tab bar (always visible, per-page links).
  - `component-card-dossier.md` — thin wide dossier card (thumbnail, title, subtitle).
  - `component-dossiers-section.md` — titled list of dossiers (per-section fetch, loading + empty states).

- **Runbooks** (`docs/ops/`) — operational procedures against the live project:
  - `first-backoffice-account.md` — creating a `backoffice` account on `bike-eco-43a84`
    with `scripts/grant-backoffice.js` (Auth user + custom claims + `users/{uid}` doc).
    No product path creates one.

# Forms conventions

- **Reuse the shared multi-step engine** — `src/lib/forms/useStepForm.ts` (react-hook-form
  + `zodResolver`, step cursor, per-step validation) drives every multi-step form. Build
  fields with the controlled wrappers in `src/components/form/` (`ControlledField`,
  `ControlledDropdown`, `ControlledCheckboxGroup`, `PhotoPicker`) over the shared
  `FormLayout`. A form = one `schema.ts` (Zod) + a declarative `steps.tsx`; see
  `src/features/b2c-submission/` as the reference implementation. Do NOT re-create
  per-step `useState` or hand-rolled validators.
- **Build forms with `react-hook-form`** — use it for form state, field registration,
  and submission. Do NOT hand-roll form state or a custom `useForm`-style hook.
- **Validation uses Zod (v4) schemas** — see the Zod section above. Do NOT hand-roll a
  custom validation hook or a parallel rules library; define one Zod schema per form and
  derive types from it. Wire Zod to react-hook-form via the `zodResolver` from
  `@hookform/resolvers/zod`.
- Multi-step forms follow the shared layout in the specs: disabled slider/stepper, H1
  title (24px bold black), subtitle (14px regular #71727A), fields, then
  "Précédent"/"Suivant" (and "S'inscrire" on the final step where applicable).
- Validate on blur and on submit, not on every keystroke.
- Error messages must be specific and actionable ("Saisissez un email valide", not
  "Champ invalide"). UI copy is in French — match the wording in the specs.
- Mandatory fields are marked with `*` and accompanied by the "* Champs obligatoires" note.

# Data / Firestore

When designing or changing data, activate the `firebase-firestore` skill and follow its
guides. Conventions in place:

- App data lives in the **named `bike-eco-db`** database (Standard edition), not
  `(default)`. The client is initialized in `firebaseConfig.ts` (`db`, `storage`, `app`).
- The data model is typed in `src/lib/firestore/schema.ts` (collections: `companies`,
  `users`, `invitations`, `dossiers`, `dossiers/*/messages`) with typed, converter-backed
  refs in `src/lib/firestore/collections.ts`. Keep these in sync when the model changes.
- `dossiers` are **B2B only** — the public B2C funnel is email-only (a Cloud Function
  sends the NORTH/SOUTH summary emails; nothing is persisted).
- `role` / `companyId` / account `status` are server-set (Auth custom claims), never
  client-writable. Security rules are default-deny and require auth.
