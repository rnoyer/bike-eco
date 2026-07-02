---
name: bike-eco-forms
description: >-
  How to build, edit, or review forms in the bike-eco Expo app — the shared
  useStepForm + FormLayout multi-step engine, single-step react-hook-form
  screens, Zod v4 schemas, the Controlled* field wrappers, design tokens, and
  the French copy/validation conventions. Use this whenever you implement, edit,
  or review ANY form, multi-step funnel, registration/signup flow, form field,
  dropdown, checkbox group, photo picker, validation schema, or submit handler
  in this project — including the pending B2B vehicle-submission,
  company-registration, and invited-registration funnels — even if the user
  doesn't say the word "form".
---

# Building forms in bike-eco

This app has **one** form engine. Every form reuses it; none hand-rolls state or
validation. Your job is to wire a new form into the engine, not to invent a new
pattern. If you find yourself writing a bespoke `useState` per field or a custom
validator, stop — you've left the convention.

Before writing code, **read the matching spec** in `docs/specs/form-*.md`. The
specs are the source of truth for steps, field order, labels, placeholders,
mandatory flags, and French copy. Copy the wording verbatim.

## The two form shapes

**Multi-step funnel** (submission funnels, registration flows) — a progress bar,
a title/subtitle per step, and Précédent/Suivant navigation. Reference
implementation: **`src/features/b2c-submission/`**. Read all three files before
building a new funnel; you are cloning this structure.

**Single-step form** (sign-in, add-colleague, one settings action) — no stepper,
just fields + a submit button. Reference: **`src/components/form/AddColleagueForm.tsx`**
and `SignInFields.tsx`.

Both use react-hook-form + Zod via the same `Controlled*` wrappers. The only
difference is multi-step uses the `useStepForm` engine + `FormLayout`; single-step
uses `useForm` directly + a plain `<View>` + `ui/Button`.

## Anatomy of a multi-step funnel

A funnel is three files in `src/features/<name>/` plus one route file:

| File | Responsibility |
|---|---|
| `schema.ts` | One Zod v4 schema + `z.infer` type + a `*_DEFAULTS` object. The single source of truth for field types and validation. |
| `steps.tsx` | Declarative `Step[]` array (`progress`, `title`, `subtitle`, `fields`, `render`). Field UI only — no state, no validation. |
| `submit.ts` | The submit handler. **Stubbed** this milestone (simulate latency, `console.log` under `__DEV__`), shaped so the real Firebase call is a drop-in later. |
| `src/app/.../<route>.tsx` | Full-screen headerless route that calls `useStepForm`, renders `FormLayout`, and swaps to `FormConfirmation` on success. |

The route wiring is mechanical and identical across funnels — copy it from
`src/app/b2cSubmissionForm.tsx`. Key pieces: `<Stack.Screen options={{ headerShown: false }} />`,
a `submitting` ref to guard double-taps, `nextLabel={isLast ? "Envoyer" : "Suivant"}`
(or `"S'inscrire"` for registration), and `handlePrev` that exits on the first step.

## Non-negotiable conventions

These come from `AGENTS.md` and the B2B forms plan; violating them fails review.

- **Reuse the engine.** `useStepForm` (`src/lib/forms/useStepForm.ts`) owns the
  react-hook-form instance, `zodResolver`, step cursor, and per-step `trigger`.
  Never re-create per-step `useState` or hand-rolled validators.
- **One Zod schema per form**, types via `z.infer` — never redeclare a field type
  by hand. This is **Zod v4**: use `z.email(...)`, `z.string().regex(...)`,
  `z.array(...).min(1, msg)`, and `.refine(...)` for cross-field rules. For any
  Zod question use the `inkeepMcp` MCP tools (see `AGENTS.md`), not memory.
- **Build fields only with the Controlled wrappers** in `src/components/form/`:
  `ControlledField`, `ControlledDropdown`, `ControlledCheckboxGroup`, `PhotoPicker`.
  They read `useFormContext`, so the screen must wrap them in `<FormProvider {...form}>`.
- **Validate on blur and on submit, never per keystroke** — the engine already sets
  `mode: "onBlur"`. Don't add `onChange` validation.
- **French copy matches the spec verbatim.** Error messages are specific and
  actionable: `"Saisissez un numéro SIRET à 14 chiffres"`, not `"Champ invalide"`.
- **Mandatory fields** get a `*` in the label and every step with a mandatory field
  shows the note `* Champs obligatoires`.
- **RN, not @expo/ui.** Forms use the RN `form/` layer. Style through
  `@/theme/tokens` and `@/components/ui/Button` — never hardcode hex/spacing that a
  token already covers (see the design-token convention).
- **Conditional fields** (reveal a field based on another's value) use `useWatch`,
  not local state — see `ElectriqueFields`/`ClesFields` in the b2c `steps.tsx`.

## Reuse-or-extract shared building blocks

Prefer these over re-declaring option lists or helpers inline. Some are created by
the B2B forms plan (`docs/superpowers/plans/2026-06-30-b2b-forms.md`); if a module
doesn't exist yet, **extract it there rather than duplicating**:

- `@/constants/departments` — `DEPARTMENTS`, `isNord`, `isSud` (exists).
- `@/constants/vehicle` — `OUI_NON`, `COUNT_OPTIONS`, `ETAT_OPTIONS`, … (plan Task 1).
- `@/lib/forms/transforms` — `digitsOnly(max?)` (plan Task 1; today it's inline in the b2c `steps.tsx`).
- `@/features/registration/fields` — `AccountFields`, `CoordonneesFields` (plan Task 5).
- `@/components/form/FormConfirmation` — the button-driven terminal screen (plan Task 2).

The registration field groups require the schema to use exact field names:
`email, password, nom, prenom, telephone, departement, ville`.

## Mapping a spec to code

The specs describe each field as `label / placeholder / type / mandatory`. Translate
each row into a Controlled component + a Zod rule using
**`references/field-catalog.md`** — it has the exact component/props and Zod pattern
for every field type in these specs (text, email, password, phone, number+unit,
year, long text, dropdown, checkboxes, département, photos, SIRET, conditional).

## Testing and verification

Per project convention, **only pure logic is unit-tested — the Zod schema.** Write
the schema test first (TDD): assert a valid object parses, and that each rule
rejects (bad email, wrong-length SIRET/phone, missing photo, failed `.refine`).
Import jest globals explicitly: `import { describe, expect, test } from "@jest/globals";`.
Step/route/field UI has **no** unit tests — it's gated by `tsc` + lint.

Gate every change with:

```bash
npx tsc --noEmit && npx expo lint && npm test
```

**Typed-routes gotcha:** adding a new route file means `tsc` can't resolve its href
until `.expo/types/router.d.ts` is regenerated, and **bare `tsc` does not regenerate
it** — the dev server does. After adding a route:

```bash
rm -f .expo/types/router.d.ts
( npx expo start > /tmp/expo-typegen.log 2>&1 & )
for i in $(seq 1 30); do [ -f .expo/types/router.d.ts ] && echo "TYPES REGENERATED" && break; sleep 1; done
pkill -f "expo start"; pkill -f "expo/cli"; sleep 1
```

**Keep specs in sync.** If a change alters a form's behavior, update its
`docs/specs/form-*.md` in the same commit.

## Quick checklist

1. Read the spec (`docs/specs/form-*.md`) and the b2c reference.
2. `schema.ts` — Zod v4 schema + `z.infer` type + `*_DEFAULTS`. Write the schema test first.
3. `submit.ts` — stubbed handler shaped for the future Firebase call.
4. `steps.tsx` — declarative steps; fields via Controlled wrappers + the field catalog; `useWatch` for conditionals.
5. Route file — clone the b2c route wiring; headerless; `FormConfirmation` on success.
6. Reuse-or-extract shared option lists / transforms / field groups.
7. `tsc` + lint + test green; regenerate typed routes if you added one; sync the spec.
