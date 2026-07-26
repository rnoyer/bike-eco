---
name: bike-eco-forms
description: >-
  Use when implementing, editing or reviewing ANY form in the bike-eco Expo app —
  a multi-step funnel or single-step screen, a registration or signup flow, a
  password or confirm-password field, a change-password or forgot/reset-password
  form, a dropdown, checkbox group or photo picker, a Zod validation schema or
  error message, a conditional field, or a submit handler — even if the request
  never says the word "form".
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
| `submit.ts` | The submit handler. Wraps a callable (`@/lib/data/*`) or an HTTP endpoint; keeps the mapping from form values to payload in one place. |
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

## Reuse the shared building blocks

All of these exist. Reach for them instead of re-declaring option lists or helpers inline:

- `@/constants/departments` — `DEPARTMENTS`, `isNord`, `isSud`.
- `@/constants/vehicle` — `OUI_NON`, `COUNT_OPTIONS`, `ETAT_OPTIONS`, …
- `@/lib/forms/transforms` — `digitsOnly(max?)`.
- `@/features/registration/fields` — `AccountFields`, `CoordonneesFields`.
- `@/components/form/FormConfirmation` — the button-driven terminal screen.

The registration field groups require the schema to use exact field names:
`email, password, nom, prenom, telephone, departement, ville`.

## Password fields

Any form with a confirmation field enforces equality **in the schema**, not in the UI, so
the rule is unit-tested. Attach the issue to the confirmation field — otherwise the error
renders under the first password box, where the user did nothing wrong:

```ts
z.object({
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
});
```

`ControlledField` takes `secureTextEntry` for password inputs — that one prop also gives
the field its eye show/hide toggle, which `FormField` renders for any masked input. Server-side auth failures
(wrong current password, expired reset link) are **not** schema errors — they come back
from Firebase and are mapped by `mapAuthError`; see `bike-eco-auth`.

## Single-step forms

A one-question screen (forgot password, add a colleague) uses `useForm` directly, not the
step engine — reference: `src/components/form/AddColleagueForm.tsx`. Same Zod schema, same
`Controlled*` wrappers, plain `<View>` + `ui/Button` instead of `FormLayout`.

Terminate on success with `FormConfirmation` (button-driven) or `ui/ConfirmationView`
(delayed auto-redirect, see `docs/specs/page-confirmation.md`) rather than routing away
immediately — the user needs to read what happened. For anything about *which* email
exists, the confirmation must not reveal it (`bike-eco-auth`).

## Mapping a spec to code

The specs describe each field as `label / placeholder / type / mandatory`. Translate
each row into a Controlled component + a Zod rule using
**`references/field-catalog.md`** — it has the exact component/props and Zod pattern
for every field type in these specs (text, email, password, phone, number+unit,
year, long text, dropdown, checkboxes, département, photos, SIRET, conditional).

## Testing and verification

**Write the schema test first (TDD).** The Zod schema is the only part of a form that is
unit-tested: assert a valid object parses, and that each rule rejects — bad email,
wrong-length SIRET/phone, missing photo, mismatched password confirmation, failed
`.refine`. Step/route/field UI has no unit tests.

The gate, the typed-routes regeneration trick (**required after adding a route file**),
and the spec-sync rule are in **`docs/tech/verification.md`**. Follow it before calling a
form done.

## Related skills

- `bike-eco-auth` — password/session semantics, `mapAuthError`, making a form's screen
  reachable while logged out.
- `bike-eco-functions` — the callable a `submit.ts` wraps, and its server-side validation.
- `bike-eco-ui` — tokens, buttons, confirmation screens.

## Quick checklist

1. Read the spec (`docs/specs/form-*.md`) and the b2c reference.
2. `schema.ts` — Zod v4 schema + `z.infer` type + `*_DEFAULTS`. Write the schema test first.
3. `submit.ts` — stubbed handler shaped for the future Firebase call.
4. `steps.tsx` — declarative steps; fields via Controlled wrappers + the field catalog; `useWatch` for conditionals.
5. Route file — clone the b2c route wiring; headerless; `FormConfirmation` on success.
6. Reuse-or-extract shared option lists / transforms / field groups.
7. `tsc` + lint + test green; regenerate typed routes if you added one; sync the spec.
