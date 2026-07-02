# Field catalog — spec type → component + Zod

Every field in `docs/specs/form-*.md` maps to one Controlled component (from
`src/components/form/`) plus one Zod rule (in the form's `schema.ts`). This is the
lookup for that translation. Field values in these forms are stored as **strings**
(or `string | null` for dropdowns, `string[]` for multi-select) — the schema mirrors
the inputs, and any coercion to numbers happens in `submit.ts`.

Helpers referenced below:
- `digitsOnly(max?)` from `@/lib/forms/transforms` (or the inline copy in the b2c `steps.tsx`).
- `requiredText(msg) = z.string().trim().min(1, msg)`.
- `optionalText = z.string().optional().default("")`.
- `optionalChoice = z.string().nullable().default(null)`.

## Text inputs

**Input text (required)**
```tsx
<ControlledField name="ville" label="Ville *" placeholder="Ville" autoCapitalize="words" returnKeyType="done" />
```
```ts
ville: requiredText("Indiquez votre ville"),
```

**Input text (optional / free text)**
```tsx
<ControlledField name="marque" label="Marque" placeholder="Marque du véhicule" autoCapitalize="words" returnKeyType="next" />
```
```ts
marque: optionalText,
```

**Input text long (multiline)**
```tsx
<ControlledField name="commentaires" label="Commentaires" placeholder="Informations complémentaires" multiline returnKeyType="done" />
```
```ts
commentaires: optionalText,
```

**Input email**
```tsx
<ControlledField name="email" label="Adresse email *" placeholder="Votre email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" />
```
```ts
email: z.email("Saisissez un email valide"),
```
Prefilled + locked (invited registration): add `editable={false}` and set the value
via `defaultValues` (e.g. `{ ...DEFAULTS, email: email ?? "" }` from `useLocalSearchParams`).

**Input password**
```tsx
<ControlledField name="password" label="Mot de passe *" placeholder="Mot de passe" secureTextEntry autoCapitalize="none" returnKeyType="done" />
```
```ts
password: z.string().min(8, "8 caractères minimum"),
```

## Numeric inputs

All numeric fields are digit-only text; strip non-digits with `transform` and coerce
in `submit.ts`. Use `suffix` for a unit shown inside the field.

**Phone (10 digits)**
```tsx
<ControlledField name="telephone" label="Téléphone *" placeholder="Votre numéro de téléphone" keyboardType="phone-pad" autoComplete="tel" transform={digitsOnly(10)} />
```
```ts
telephone: z.string().regex(/^\d{10}$/, "Saisissez un numéro à 10 chiffres"),
```

**SIRET (14 digits)**
```tsx
<ControlledField name="siret" label="Numéro SIRET *" placeholder="14 chiffres" keyboardType="numeric" maxLength={14} transform={digitsOnly(14)} returnKeyType="next" />
```
```ts
siret: z.string().regex(/^\d{14}$/, "Saisissez un numéro SIRET à 14 chiffres"),
```

**Year (4 digits)**
```tsx
<ControlledField name="annee" label="Année" placeholder="Année de mise en service" keyboardType="numeric" maxLength={4} transform={digitsOnly(4)} returnKeyType="next" />
```
```ts
annee: optionalText,
```

**Number with unit (km, €)**
```tsx
<ControlledField name="kilometrage" label="Kilométrage" placeholder="Kilométrage du véhicule" keyboardType="numeric" suffix="km" transform={digitsOnly()} returnKeyType="next" />
<ControlledField name="prix" label="Prix souhaité" placeholder="€" keyboardType="numeric" suffix="€" transform={digitsOnly()} returnKeyType="next" />
```
```ts
kilometrage: optionalText,
prix: optionalText,
```

## Choice inputs

**Dropdown — oui / non**
```tsx
<ControlledDropdown name="carteGrise" label="Avez-vous la carte grise du véhicule ?" options={OUI_NON} />
```
```ts
carteGrise: optionalChoice,   // or requiredChoice if mandatory
```

**Dropdown — counts (0–4)**
```tsx
<ControlledDropdown name="cleNoire" label="Clé noire" options={COUNT_OPTIONS} />
```
```ts
cleNoire: optionalChoice,
```

**Dropdown — enum with placeholder**
```tsx
<ControlledDropdown name="etat" label="Dans quel état se trouve votre moto ?" placeholder="État du véhicule" options={ETAT_OPTIONS} />
```
```ts
etat: optionalChoice,
```

**Dropdown — département (searchable, long list)**
```tsx
<ControlledDropdown name="departement" label="Département *" placeholder="Département" options={DEPARTMENTS} searchable />
```
```ts
departement: requiredText("Sélectionnez un département"),
```
`ControlledDropdown`/`Dropdown` take `options: string[]` where label === value. For a
label≠value list (e.g. status "À traiter" ↔ `a_traiter`, or region labels), feed the
labels as options and map label→value on submit — see `DossierManagementForm.tsx` /
`SettingsList.tsx`.

**Checkbox group (multi-select)**
```tsx
<ControlledCheckboxGroup name="materiel" label="Cochez le matériel en votre possession" options={MATERIEL_OPTIONS} />
```
```ts
materiel: z.array(z.string()).default([]),
```

## Photos

```tsx
const { control } = useFormContext<FormType>();
<Controller
  control={control}
  name="photos"
  render={({ field, fieldState }) => (
    <PhotoPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} min={1} />
  )}
/>
```
```ts
photos: z.array(z.string()).min(1, "Ajoutez au moins 1 photo du véhicule"),
```

## Conditional fields

Reveal a dependent field with `useWatch` (never local state). The gating field's
value drives whether the dependent renders; the dependent stays optional in the schema.
```tsx
function ElectriqueFields() {
  const electrique = useWatch<FormType, "electrique">({ name: "electrique" });
  return (
    <>
      <ControlledDropdown name="electrique" label="S'agit-il d'un véhicule électrique ?" options={OUI_NON} />
      {electrique === "oui" && (
        <ControlledCheckboxGroup name="materiel" label="Cochez le matériel en votre possession" options={MATERIEL_OPTIONS} />
      )}
    </>
  );
}
```

## Cross-field rules (`.refine`)

When "mandatory" depends on another field — e.g. Marque OR Modèle required, not both —
use `.refine` on the object and point the error at a field via `path`:
```ts
.refine((v) => v.marque.trim().length > 0 || v.modele.trim().length > 0, {
  message: "Renseignez la marque ou le modèle",
  path: ["marque"],
});
```

## Inline links under a field

Some fields carry an underlined external link (e.g. the non-gage certificate). Render a
`TouchableOpacity` + `Linking.openURL(...)` beneath the dropdown, wrapped so they read as
one unit — see `PapiersFields` in the b2c `steps.tsx`.
