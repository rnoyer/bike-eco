# Dossier — complete "Informations véhicule", and `InfoCollapsibleRow`

## Problem

The dossier page shows five of the roughly twenty vehicle answers the B2B funnel
collects. Everything under `keys`, most of `papers`, `condition.naturePanne` and
`vehicle.materiel` is written to Firestore at submission and then never read back —
neither the b2b submitter nor the back office can see it.

Rendering all of it as flat `InfoRows` would give the card a wall of twenty rows, most
of them irrelevant to a given dossier (the key colours only matter when the seller has
keys; the CT result only when there is a CT). So the fix is two things at once: a new
`InfoCard` part that hides conditional detail behind a chevron, and a rebuilt
"Informations véhicule" that uses it.

### The "Accessoires" bug is a data problem

The card renders `<InfoComment label="Accessoires" text={vehicle.accessoires} />`, and
users report it shows comments rather than accessories. It does — faithfully. The B2B
funnel, the only source of dossiers, has **no accessories input**. Its step-2 free-text
field is labelled "Commentaires" with the placeholder "Ex. Etat de la moto"
(`MotoFields` in `src/features/b2b-submission/steps.tsx`) and is stored in `vehicle.accessoires`
(`schema.ts:23`, `toDossier.ts:84`). The B2C funnel does have a real "Accessoires" input,
but B2C never persists a dossier.

**Decision: rename the row, change no data.** The row becomes "Commentaires véhicule" —
labelled for what the field actually holds — and no "Accessoires" row is rendered. No
Zod schema, `toDossier`, or Firestore model change, so existing dossiers keep reading
correctly.

**Follow-up, out of scope:** the B2B funnel collects no accessories at all while B2C
does. Adding a real `Accessoires` input to B2B (and a `vehicle.commentaires` field to the
model to hold the step-2 comment) is a separate change with its own migration question
for existing documents.

## `InfoCollapsibleRow`

A fourth `InfoCard` part, alongside `InfoRows`, `InfoContactRow` and `InfoComment`.
Lives at `src/components/ui/InfoCollapsibleRow.tsx`.

### API

```tsx
<InfoCollapsibleRow
  label="Électrique"
  value={vehicle.electrique}
  rows={
    isOui(vehicle.electrique)
      ? [
          ["Batterie présente", ouiNon(hasMateriel(vehicle.materiel, "batterie"))],
          ["Chargeur présent", ouiNon(hasMateriel(vehicle.materiel, "chargeur"))],
        ]
      : null
  }
/>
```

```ts
{
  label: string;
  value: string | null | undefined;   // dashed by the component, like every other part
  rows?: InfoRow[] | null;            // null / undefined / empty ⇒ not collapsible
}
```

**`rows` is the switch.** Passing `null` renders exactly the `InfoRows` shape — bold
label, value, no button, no chevron. That is the "non / —" state. The condition
("collapsible only when the answer is oui") therefore lives at the call site, next to
the domain rule it encodes, rather than hidden inside the component.

### Collapsed appearance

Identical to `InfoContactRow`'s header, deliberately — the two are the same visual
species (a label/value row with one right-hand action):

- `flexDirection: "row"`, `alignItems: "center"`, `gap: tokens.space.sm`
- label: 14px / 700 / `tokens.colors.primary`, with a trailing `" :"`
- value: 14px / `primary`, `flex: 1` so it takes the slack and wraps rather than pushing
  the button out of the card
- button hard right

The hairlines the row appears to carry are the **card's** dividers, not the row's — every
part relies on `InfoCard` for those (see `component-info-card.md`). Each collapsible is
its own part, so it is fenced above and below.

### The button

The shared `IconButton` (`src/components/ui/IconButton.tsx`) with
`assets/images/icons/chevron-right.svg`. Not a hand-rolled Pressable: `IconButton` exists
precisely so the contact rows and the dossier bell cannot drift apart, and a third
treatment would defeat it.

This needs one addition to `IconButton`: an optional `iconStyle?: StyleProp<ViewStyle>`,
applied to an `Animated.View` (Reanimated) wrapping its glyph. Existing callers pass
nothing and are unaffected.

**The style goes on a wrapper `View`, not on the `Image`.** `expo-image`'s `Image` is not
an Animated component, so a Reanimated style cannot be applied to it directly —
`ZoomableImage` already documents this and wraps its image the same way. Do not reach for
`Animated.createAnimatedComponent(Image)`.

### Animation

Reanimated (`react-native-reanimated@4.5.1`, already a dependency):
`useSharedValue` → `withTiming(expanded ? 90 : 0, { duration: 150 })`, applied as
`transform: [{ rotate: "…deg" }]`.

**The glyph rotates, not the button box.** Rotating the box would swing its `radius.sm`
corners, which reads as a bug.

The reveal itself is instant — the sub-rows mount and unmount. Animating the height of a
variable-length list buys jank, not clarity. Only the chevron animates.

### Sub-rows

Rendered through the existing `InfoRows`, inset `tokens.space.md` from the left so they
read as children of the header rather than peers of it.

### Accessibility

An icon-only button is unreachable by a screen reader without a label, so:

- `accessibilityLabel`: `"Afficher le détail : {label}"` when collapsed,
  `"Masquer le détail : {label}"` when expanded.
- `accessibilityState={{ expanded }}` on the button. That state belongs on the `Pressable`
  `IconButton` owns, so `IconButton` takes an optional `expanded?: boolean` alongside
  `iconStyle` rather than having it passed in from outside.

## The rebuilt "Informations véhicule"

Eleven parts, a hairline between each. **Identical for both roles** — `VehicleCard` is
already shared by b2b and back-office, and nothing here branches on role.

| # | Part | Rows | Source |
|---|---|---|---|
| 1 | `InfoRows` | Prix souhaité · Marque · Modèle et Cylindrée · Année · Kilométrage | `pricing.prix`, `vehicle.*` |
| 2 | **Collapsible** | Électrique → Batterie présente · Chargeur présent | `vehicle.electrique`, `vehicle.materiel` |
| 3 | `InfoRows` | État | `condition.etat` |
| 4 | `InfoComment` | Nature de la panne — **only when `etat === "En Panne"`** | `condition.naturePanne` |
| 5 | **Collapsible** | Carte grise → À votre nom | `papers.carteGrise`, `papers.carteGriseAVotreNom` |
| 6 | **Collapsible** | Contrôle technique → Moins de 6 mois · Résultat obtenu | `papers.controleTechnique`, `papers.ctMoins6Mois`, `papers.resultatCT` |
| 7 | `InfoRows` | Certificat de non-gage · Carnet d'entretien · Facture d'entretien | `papers.*` |
| 8 | **Collapsible** | Clés de contact → Clé noire · Clé marron · Clé rouge | `keys.aClesContact`, `keys.cleNoire/cleMarron/cleRouge` |
| 9 | **Collapsible** | Télécommande ou Bip → Nombre | `keys.aTelecommande`, `keys.telecommande` |
| 10 | `InfoComment` | Commentaires véhicule | `vehicle.accessoires` |
| 11 | `InfoComment` | Commentaires complémentaire | `pricing.commentaires` |

Details that are easy to get wrong:

- **"Prix souhaité" moves to the top**, out of part 7's predecessor and into part 1. It is
  the number a reader looks for first.
- **The panne enum is `"En Panne"`, capital P** (`ETATS_VEHICULE`, `schema.ts:45`). Part 4
  keys off the constant, not a string literal.
- **Every collapsible expands only on `"oui"`.** `papers.carteGriseAVotreNom`,
  `ctMoins6Mois`, `resultatCT`, the three key counts and the remote count are all `null`
  when the parent answer was not "oui", so there is nothing to reveal.
- **A key count of `0` must render `"0"`, not `"—"`.** `dash()` treats only
  `null` / `undefined` / `""` as absent, so `dash(0) === "0"` already. Do not "fix" this
  with a falsy check.
- `vehicle.cylindree` stays unrendered: the B2B funnel merges cylindrée into `modele`, so
  the field is always `null`.

## Helpers

Three pure helpers in `src/lib/ui/format.ts`, with unit tests in
`src/lib/ui/__tests__/` — the house convention is that pure logic is tested while UI is
gated by `tsc` + lint (`docs/tech/verification.md`):

- `ouiNon(value: boolean): "oui" | "non"` — renders a derived boolean in the same
  vocabulary as every stored `OuiNon`, so "Batterie présente" reads like its neighbours.
- `hasMateriel(materiel: string[], item: "batterie" | "chargeur"): boolean` — membership
  in `vehicle.materiel`, whose stored values are the checkbox labels themselves
  (`MATERIEL_OPTIONS = ["J'ai la batterie", "J'ai le chargeur"]`, `src/constants/vehicle.ts`).
  The helper owns that coupling so the screen never string-matches French copy inline.
  `src/constants/vehicle.ts` gains named `MATERIEL_BATTERIE` / `MATERIEL_CHARGEUR`
  constants that `MATERIEL_OPTIONS` is then built from, so the two sides reference one
  string rather than two copies of it.
- `isOui(value: string | null | undefined): boolean` — the `v === "oui"` guard the five
  collapsibles use to decide whether they have anything to reveal.

## Documentation to update in the same change

- `docs/specs/component-info-card.md` — add `InfoCollapsibleRow` as the fourth part kind
  (API, collapsed/expanded behaviour, the `rows`-is-the-switch rule, the `IconButton`
  reuse), and update the Callers table's Dossier row.
- `docs/specs/page-dossier.md` — replace the four-part "Informations véhicule" list with
  the eleven parts above.

## Also in this change

`assets/images/icons/chevron-right.svg` currently exists untracked in the working tree;
it gets committed here.

## Verification

```bash
npx tsc --noEmit && npx expo lint && npm test
```

No new route file, so no typed-routes regeneration. No Firestore model, rules or index
change, so no `npm run test:rules` run is required.

Manual check on the emulator, both roles, against a dossier with keys and a CT:
every collapsible expands and collapses, the chevron rotates 90° and back, a "non"
answer shows no button, and a zero key count reads "0".

## Out of scope

- Adding a real "Accessoires" input to the B2B funnel (see above).
- Any change to the B2C funnel, which does not persist dossiers.
- `page-dossier-management`, the chat tab, and the seller/dossier cards.
