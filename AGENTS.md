# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

# Zod (v4) documentation

When working with Zod or answering questions about it, use the `inkeepMcp` MCP tools:
- **Zod (v4) Documentation Search** — search Zod's documentation, GitHub issues, release notes, and help center.
- **Ask Zod (v4) Expert** — ask specific questions about Zod's APIs or implementation details.

# Project docs

These specs are the source of truth for product behavior and form structure. Read the
relevant file **before** building or editing the corresponding feature. Keep a spec in
sync in the same change that alters its feature.

- **Product overview** — `docs/product/bike-eco-app.md`: the three paths (B2C public
  funnel, B2B dealer dashboard, Bike-eco back office), plus the chat and dossier
  features. Read this first for context on any feature work.
- **Form specs** (`docs/specs/`) — exact step/field/validation definitions. Read the
  matching file before implementing or changing any form or its validation:
  - `b2c-vehicule-submission-form.md` — public (non-logged-in) B2C vehicle submission funnel.
  - `b2b-vehicule-submission-form.md` — logged-in B2B "Vendre une moto" submission form.
  - `b2b-company-registration-form.md` — B2B company signup (SIRET + company, account, contact; 4 steps).
  - `b2b-invited-registration-form.md` — invited team-member registration (prefilled disabled email; 3 steps).

# Forms conventions

- **Validation uses Zod (v4) schemas** — see the Zod section above. Do NOT hand-roll a
  custom validation hook or a parallel rules library; define one Zod schema per form and
  derive types from it.
- Multi-step forms follow the shared layout in the specs: disabled slider/stepper, H1
  title (24px bold black), subtitle (14px regular #71727A), fields, then
  "Précédent"/"Suivant" (and "S'inscrire" on the final step where applicable).
- Validate on blur and on submit, not on every keystroke.
- Error messages must be specific and actionable ("Saisissez un email valide", not
  "Champ invalide"). UI copy is in French — match the wording in the specs.
- Mandatory fields are marked with `*` and accompanied by the "* Champs obligatoires" note.
