# Dossier "Informations véhicule" + `InfoCollapsibleRow` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show every vehicle answer the B2B funnel collects on the dossier page, keeping the card compact by hiding conditional detail behind a new collapsible `InfoCard` part.

**Architecture:** One new presentational component, `InfoCollapsibleRow`, joins `InfoRows` / `InfoContactRow` / `InfoComment` as a fourth `InfoCard` part. It reuses the shared `IconButton` for its chevron (which gains one optional style prop) and the existing `InfoRows` for its sub-rows. `VehicleCard` in `DossierDetailScreen` is then rewritten from four parts to eleven. No data-model, Firestore-rules, or form change.

**Tech Stack:** React Native + Expo SDK 57, TypeScript, `react-native-reanimated@4.5.1`, `expo-image`, Jest (`jest-expo`).

**Spec:** `docs/superpowers/specs/2026-08-11-dossier-vehicle-info-design.md` — read it before starting.

## Global Constraints

- **The gate for every task** (`docs/tech/verification.md`): `npx tsc --noEmit && npx expo lint && npm test`. All three must be green before committing.
- **House testing convention:** pure logic is unit-tested; screens and components are gated by `tsc` + lint only. **Do not add render tests** for `InfoCollapsibleRow` or `VehicleCard` — that is not this repo's style.
- **Import jest globals explicitly:** `import { describe, expect, test } from "@jest/globals";`
- **Never hardcode a colour or spacing value** a token covers. Everything comes from `@/theme/tokens` (`space.xs 4 · sm 8 · md 12 · lg 24 · xl 28`, `radius.sm 8 · md 12 · lg 16`, `colors.primary #2A2933`, `colors.brand #1FC61B`).
- **All UI copy is French**, verbatim from the spec.
- **A part never draws its own divider.** `InfoCard` owns the hairlines between parts.
- **`dash()` already renders `"0"` for zero** (only `null` / `undefined` / `""` are absent). Never replace it with a falsy check — a key count of 0 is real data.
- **`expo-image`'s `Image` is not an Animated component.** A Reanimated style goes on an `Animated.View` wrapper. `src/components/ui/ZoomableImage.tsx` is the precedent.
- **No new route file**, so no typed-routes regeneration. **No Firestore change**, so `npm run test:rules` is not required.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `src/constants/vehicle.ts` | Gains named `MATERIEL_BATTERIE` / `MATERIEL_CHARGEUR` that `MATERIEL_OPTIONS` is built from | 1 |
| `src/lib/ui/format.ts` | Gains `isOui`, `ouiNon`, `hasMateriel` — the app's one display-formatting module | 1 |
| `src/lib/ui/__tests__/format.test.ts` | Unit tests for the three helpers | 1 |
| `src/components/ui/IconButton.tsx` | Gains optional `iconStyle` on an `Animated.View` wrapping its glyph | 2 |
| `src/components/ui/InfoCollapsibleRow.tsx` | **New.** The fourth `InfoCard` part | 2 |
| `assets/images/icons/chevron-right.svg` | Currently untracked; committed | 2 |
| `docs/specs/component-info-card.md` | Documents the new part | 2 |
| `src/components/screens/DossierDetailScreen.tsx` | `VehicleCard` rebuilt to eleven parts | 3 |
| `docs/specs/page-dossier.md` | Documents the new section | 3 |

---

### Task 1: Display helpers for the derived vehicle answers

Three pure helpers the dossier card needs. `vehicle.materiel` stores the funnel's checkbox
labels ("J'ai la batterie"), but the dossier reads "Batterie présente : oui" — so something
has to own that translation, and it belongs in `format.ts` with the rest of the display
formatting, not inline in a screen.

**Files:**
- Modify: `src/constants/vehicle.ts` (last line, `MATERIEL_OPTIONS`)
- Modify: `src/lib/ui/format.ts` (append; `dash` is at the top of the file)
- Test: `src/lib/ui/__tests__/format.test.ts` (append)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces, all imported by Task 3 from `@/lib/ui/format`:
  - `isOui(v: string | null | undefined): boolean`
  - `ouiNon(v: boolean): OuiNon` (`"oui" | "non"`, from `@/lib/firestore/schema`)
  - `hasMateriel(materiel: string[] | null | undefined, item: "batterie" | "chargeur"): boolean`
- Also produces, from `@/constants/vehicle`: `MATERIEL_BATTERIE`, `MATERIEL_CHARGEUR` (string constants).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/ui/__tests__/format.test.ts`:

```ts
describe("isOui", () => {
  test("is true only for the stored \"oui\"", () => {
    expect(isOui("oui")).toBe(true);
    expect(isOui("non")).toBe(false);
  });

  test("is false for an unanswered field", () => {
    expect(isOui(null)).toBe(false);
    expect(isOui(undefined)).toBe(false);
    expect(isOui("")).toBe(false);
  });
});

describe("ouiNon", () => {
  test("renders a derived boolean in the stored vocabulary", () => {
    expect(ouiNon(true)).toBe("oui");
    expect(ouiNon(false)).toBe("non");
  });
});

describe("hasMateriel", () => {
  test("matches the funnel's own checkbox labels", () => {
    expect(hasMateriel([MATERIEL_BATTERIE], "batterie")).toBe(true);
    expect(hasMateriel([MATERIEL_BATTERIE], "chargeur")).toBe(false);
    expect(hasMateriel([MATERIEL_BATTERIE, MATERIEL_CHARGEUR], "chargeur")).toBe(
      true,
    );
  });

  test("treats an absent list as nothing checked", () => {
    expect(hasMateriel([], "batterie")).toBe(false);
    expect(hasMateriel(null, "batterie")).toBe(false);
    expect(hasMateriel(undefined, "chargeur")).toBe(false);
  });
});
```

Add the imports at the top of the same file — extend the existing `from "../format"` block and add the constants import:

```ts
import { MATERIEL_BATTERIE, MATERIEL_CHARGEUR } from "@/constants/vehicle";

import {
  dash,
  euros,
  hasMateriel,
  isOui,
  kilometres,
  ouiNon,
  regionLabel,
  statusLabel,
  submittedAt,
  viewerStatus,
} from "../format";
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx jest src/lib/ui/__tests__/format.test.ts
```

Expected: FAIL — `isOui`, `ouiNon`, `hasMateriel`, `MATERIEL_BATTERIE` and `MATERIEL_CHARGEUR` are not exported yet.

- [ ] **Step 3: Name the materiel constants**

In `src/constants/vehicle.ts`, replace the last line:

```ts
export const MATERIEL_OPTIONS = ["J'ai la batterie", "J'ai le chargeur"];
```

with:

```ts
// Named individually because the dossier page reads them back out of
// `vehicle.materiel` — the funnel stores the checkbox *label*, so both sides
// have to agree on one string rather than keep a copy each.
export const MATERIEL_BATTERIE = "J'ai la batterie";
export const MATERIEL_CHARGEUR = "J'ai le chargeur";
export const MATERIEL_OPTIONS = [MATERIEL_BATTERIE, MATERIEL_CHARGEUR];
```

`MATERIEL_OPTIONS` keeps its name and value, so `ElectriqueFields` needs no change.

- [ ] **Step 4: Add the three helpers**

Append to `src/lib/ui/format.ts`:

```ts
/**
 * `true` only for the stored `"oui"`.
 *
 * The dossier's collapsible rows use it to decide whether they have anything to
 * reveal: every sub-answer (`carteGriseAVotreNom`, the key counts, the CT
 * result…) is left `null` by the funnel unless the parent answer was "oui".
 */
export const isOui = (v: string | null | undefined): boolean => v === "oui";

/** Renders a *derived* boolean in the same vocabulary as a stored `OuiNon`, so
 *  "Batterie présente : oui" reads like the rows around it. */
export const ouiNon = (v: boolean): OuiNon => (v ? "oui" : "non");

/**
 * Whether the seller checked "J'ai la batterie" / "J'ai le chargeur".
 *
 * `vehicle.materiel` stores the funnel's checkbox *labels*, so the coupling to
 * that French copy lives here rather than in the screen — the dossier asks for
 * `"batterie"` and renders its own "Batterie présente" label.
 */
export const hasMateriel = (
  materiel: string[] | null | undefined,
  item: "batterie" | "chargeur",
): boolean =>
  (materiel ?? []).includes(
    item === "batterie" ? MATERIEL_BATTERIE : MATERIEL_CHARGEUR,
  );
```

Extend the two import blocks at the top of `format.ts`:

```ts
import { MATERIEL_BATTERIE, MATERIEL_CHARGEUR } from "@/constants/vehicle";
import type {
  DossierStatus,
  OuiNon,
  Region,
  UserRole,
} from "@/lib/firestore/schema";
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
npx jest src/lib/ui/__tests__/format.test.ts
```

Expected: PASS, including the pre-existing `dash` / `euros` / `viewerStatus` describes.

- [ ] **Step 6: Run the full gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all three green.

- [ ] **Step 7: Commit**

```bash
git add src/constants/vehicle.ts src/lib/ui/format.ts src/lib/ui/__tests__/format.test.ts
git commit -m "feat(ui): add isOui, ouiNon and hasMateriel display helpers"
```

---

### Task 2: `InfoCollapsibleRow`

The fourth `InfoCard` part. Collapsed it is visually an `InfoContactRow`; expanded it adds
`InfoRows` beneath. Its chevron is the shared `IconButton`, which gains one optional prop
so a rotation can be driven onto its glyph.

**Files:**
- Modify: `src/components/ui/IconButton.tsx`
- Create: `src/components/ui/InfoCollapsibleRow.tsx`
- Commit (currently untracked): `assets/images/icons/chevron-right.svg`
- Modify: `docs/specs/component-info-card.md`

**Interfaces:**
- Consumes: `InfoRow` (`[label: string, value: string]`) and the default export from `@/components/ui/InfoRows`; the default export from `@/components/ui/IconButton`.
- Produces, for Task 3 — the default export of `@/components/ui/InfoCollapsibleRow`:

```ts
{
  label: string;
  value: string | null | undefined;
  /** `null` / `undefined` / `[]` ⇒ the row is not collapsible. */
  rows?: InfoRow[] | null;
}
```

- Produces on `IconButton`: a new optional `iconStyle?: StyleProp<ViewStyle>`.

- [ ] **Step 1: Give `IconButton` an animatable glyph wrapper**

Rewrite the body and styles of `src/components/ui/IconButton.tsx`. Keep the existing file
header comment; add the `iconStyle` prop and wrap the `Image`:

```tsx
import { Image } from "expo-image";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { tokens } from "@/theme/tokens";

export default function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  iconStyle,
  expanded,
}: {
  /** A required SVG module, e.g. `require("@/assets/images/icons/phone.svg")`. */
  icon: number;
  /** Icon-only, so without this the button is unreachable by a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  /** Applied to an `Animated.View` around the glyph — for `InfoCollapsibleRow`'s
   *  rotating chevron. It sits on a wrapper because `expo-image`'s `Image` is
   *  not an Animated component (see `ZoomableImage`), and on the *glyph* rather
   *  than the button so the green box's `radius.sm` corners don't swing. */
  iconStyle?: StyleProp<ViewStyle>;
  /** Announced to screen readers by a button that expands a disclosure. */
  expanded?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Animated.View style={iconStyle}>
        <Image
          source={icon}
          style={styles.icon}
          tintColor={tokens.colors.primary}
          contentFit="contain"
        />
      </Animated.View>
    </Pressable>
  );
}
```

Leave the `styles` block exactly as it is. The wrapper adds no layout of its own — the
`Image` carries explicit `width`/`height`.

- [ ] **Step 2: Create `InfoCollapsibleRow`**

Create `src/components/ui/InfoCollapsibleRow.tsx`:

```tsx
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import chevronRightIcon from "@/assets/images/icons/chevron-right.svg";
import IconButton from "@/components/ui/IconButton";
import InfoRows, { type InfoRow } from "@/components/ui/InfoRows";
import { dash } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";

/** How long the chevron takes to swing between its two positions. */
const ROTATION_MS = 150;

/**
 * The "collapsible" part of an `InfoCard`: a label/value row that reveals more
 * `InfoRows` beneath it when tapped.
 *
 * Collapsed, it is deliberately identical to `InfoContactRow` — the two are the
 * same visual species, a label/value row with one right-hand action. The
 * hairlines above and below are the *card's*; this part draws none.
 *
 * `rows` is the switch: pass `null` and the row renders with no button and
 * nothing to expand. That keeps the domain rule ("there is only detail when the
 * answer was oui") at the call site next to the fields it is about, instead of
 * buried in here.
 */
export default function InfoCollapsibleRow({
  label,
  value,
  rows,
}: {
  label: string;
  value: string | null | undefined;
  rows?: InfoRow[] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  // Rotates the glyph only. Rotating the button would swing its `radius.sm`
  // corners through the transition, which reads as a bug.
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const collapsible = !!rows && rows.length > 0;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    rotation.value = withTiming(next ? 90 : 0, { duration: ROTATION_MS });
  };

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={styles.label}>{label} :</Text>
        <Text style={styles.value}>{dash(value)}</Text>
        {collapsible ? (
          <IconButton
            icon={chevronRightIcon}
            // An icon-only button is unreachable by a screen reader without
            // this, and the label has to say which row it opens.
            accessibilityLabel={`${expanded ? "Masquer" : "Afficher"} le détail : ${label}`}
            expanded={expanded}
            iconStyle={chevronStyle}
            onPress={toggle}
          />
        ) : null}
      </View>
      {/* Mount/unmount, not an animated height: the list is short and
          variable-length, so animating it buys jank rather than clarity. */}
      {collapsible && expanded ? (
        <View style={styles.detail}>
          <InfoRows rows={rows} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: tokens.space.sm },
  // Mirrors `InfoContactRow`'s row exactly — same species, same shape.
  header: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  label: { fontSize: 14, fontWeight: "700", color: tokens.colors.primary },
  // Takes the slack so the button sits on the right edge, and wraps rather than
  // pushing the button out of the card.
  value: { fontSize: 14, color: tokens.colors.primary, flex: 1 },
  // Inset so the sub-rows read as children of the header, not peers of it.
  detail: { paddingLeft: tokens.space.md },
});
```

Note `Animated` is imported for its side-effect-free `useAnimatedStyle` /
`useSharedValue` / `withTiming` here; the `Animated` default import itself is unused in
this file, so **drop it from the import** if lint flags it:

```tsx
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
```

- [ ] **Step 3: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all three green. If `tsc` complains that `InfoRows` has no named `InfoRow`
export, check `src/components/ui/InfoRows.tsx` — it exports
`export type InfoRow = [label: string, value: string]` alongside its default export.

- [ ] **Step 4: Document the new part**

In `docs/specs/component-info-card.md`, under the "## Parts" section, change the opening
line from "Three kinds, all in `src/components/ui/`." to "Four kinds, all in
`src/components/ui/`." and add this after the `InfoComment` subsection:

````markdown
### `InfoCollapsibleRow` — ligne repliable

```tsx
<InfoCollapsibleRow
  label="Contrôle technique"
  value={papers.controleTechnique}
  rows={isOui(papers.controleTechnique) ? [
    ["Moins de 6 mois", dash(papers.ctMoins6Mois)],
    ["Résultat obtenu", dash(papers.resultatCT)],
  ] : null}
/>
```

A label/value row that reveals further `InfoRows` beneath it when tapped. Collapsed it is
deliberately indistinguishable from an `InfoContactRow`: the same row shape, the same
right-aligned `IconButton`, and the card's hairlines above and below it.

- **`rows` is the switch.** `null`, `undefined` or `[]` renders the row with no button and
  nothing to expand — the "non / —" state. The condition therefore lives at the call site,
  next to the fields it is about, rather than inside the component. Every caller on
  [page-dossier](page-dossier.md) gates on `isOui`, because the funnel leaves every
  sub-answer `null` unless the parent answer was "oui".
- The button is the shared `IconButton` with `assets/images/icons/chevron-right.svg`,
  carrying `accessibilityState={{ expanded }}` and a French label that flips between
  "Afficher le détail : {label}" and "Masquer le détail : {label}".
- **The glyph rotates 90°, not the button** — `withTiming` over 150ms
  (`react-native-reanimated`). Rotating the button would swing its `radius.sm` corners
  through the transition. The style sits on an `Animated.View` inside `IconButton`
  (its `iconStyle` prop) because `expo-image`'s `Image` is not an Animated component.
- The reveal itself is a mount/unmount, not an animated height: the sub-row list is short
  and variable-length, so animating it buys jank rather than clarity.
- Sub-rows render through `InfoRows`, inset `space.md` from the left so they read as
  children of the header.
````

Then update the Callers table's two Dossier rows to:

```markdown
| [Dossier](page-dossier.md) | "Informations Dossier" | Date de soumission · Statut · Prix validé · Région |
| Dossier | "Informations véhicule" | 11 parts — see [page-dossier.md](page-dossier.md) |
| Dossier | "Informations vendeur" | rows · Téléphone · Email |
```

- [ ] **Step 5: Commit, including the icon**

`assets/images/icons/chevron-right.svg` is untracked in the working tree — verify it is
there and staged, or the component renders nothing.

```bash
git add assets/images/icons/chevron-right.svg \
        src/components/ui/IconButton.tsx \
        src/components/ui/InfoCollapsibleRow.tsx \
        docs/specs/component-info-card.md
git status --short   # confirm chevron-right.svg is staged as "A"
git commit -m "feat(ui): add InfoCollapsibleRow, a collapsible InfoCard part"
```

---

### Task 3: Rebuild "Informations véhicule"

Replace `VehicleCard`'s four parts with eleven. Both roles get the identical card —
`VehicleCard` is already shared and nothing here branches on role.

**Files:**
- Modify: `src/components/screens/DossierDetailScreen.tsx` — the `VehicleCard` function only
- Modify: `docs/specs/page-dossier.md`

**Interfaces:**
- Consumes: `InfoCollapsibleRow` (Task 2), and `isOui` / `ouiNon` / `hasMateriel` (Task 1) from `@/lib/ui/format`.
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Rewrite `VehicleCard`**

In `src/components/screens/DossierDetailScreen.tsx`, replace the whole `VehicleCard`
function with:

```tsx
function VehicleCard({ dossier }: { dossier: Dossier }) {
  const { vehicle, keys, condition, papers, pricing } = dossier;
  return (
    <InfoCard title="Informations véhicule">
      <InfoRows
        rows={[
          // The number a reader looks for first, so it leads the card.
          ["Prix souhaité", euros(pricing.prix)],
          ["Marque", vehicle.marque],
          // The B2B funnel — the only source of dossiers — collects model and
          // displacement in one "Modèle et Cylindrée" field, so they are one
          // row and `vehicle.cylindree` is always null and never rendered.
          ["Modèle et Cylindrée", vehicle.modele],
          // `InfoRows` dashes empty values itself; `dash()` here is what turns a
          // non-string field into the `[label, value]` pair's string.
          ["Année", dash(vehicle.annee)],
          ["Kilométrage", kilometres(vehicle.kilometrage)],
        ]}
      />
      <InfoCollapsibleRow
        label="Électrique"
        value={vehicle.electrique}
        rows={
          isOui(vehicle.electrique)
            ? [
                // `materiel` stores the funnel's checkbox labels; `hasMateriel`
                // owns that coupling so this stays readable.
                ["Batterie présente", ouiNon(hasMateriel(vehicle.materiel, "batterie"))],
                ["Chargeur présent", ouiNon(hasMateriel(vehicle.materiel, "chargeur"))],
              ]
            : null
        }
      />
      <InfoRows rows={[["État", dash(condition.etat)]]} />
      {/* Free text, and only ever filled for this one état — `etat` is typed
          `EtatVehicule | null`, so a typo in the literal fails to compile. */}
      {condition.etat === "En Panne" ? (
        <InfoComment label="Nature de la panne" text={condition.naturePanne} />
      ) : null}
      <InfoCollapsibleRow
        label="Carte grise"
        value={papers.carteGrise}
        rows={
          isOui(papers.carteGrise)
            ? [["À votre nom", dash(papers.carteGriseAVotreNom)]]
            : null
        }
      />
      <InfoCollapsibleRow
        label="Contrôle technique"
        value={papers.controleTechnique}
        rows={
          isOui(papers.controleTechnique)
            ? [
                ["Moins de 6 mois", dash(papers.ctMoins6Mois)],
                ["Résultat obtenu", dash(papers.resultatCT)],
              ]
            : null
        }
      />
      <InfoRows
        rows={[
          ["Certificat de non-gage", dash(papers.certificatNonGage)],
          ["Carnet d'entretien", dash(papers.carnetEntretien)],
          ["Facture d'entretien", dash(papers.factureEntretien)],
        ]}
      />
      <InfoCollapsibleRow
        label="Clés de contact"
        value={keys.aClesContact}
        rows={
          isOui(keys.aClesContact)
            ? [
                // `dash(0)` is "0", not "—": zero keys of a colour is an answer.
                ["Clé noire", dash(keys.cleNoire)],
                ["Clé marron", dash(keys.cleMarron)],
                ["Clé rouge", dash(keys.cleRouge)],
              ]
            : null
        }
      />
      <InfoCollapsibleRow
        label="Télécommande ou Bip"
        value={keys.aTelecommande}
        rows={
          isOui(keys.aTelecommande)
            ? [["Nombre", dash(keys.telecommande)]]
            : null
        }
      />
      {/* `vehicle.accessoires` holds the funnel's step-2 "Commentaires (Ex. État
          de la moto)". The B2B funnel collects no accessories at all, so the row
          is labelled for what the field actually contains. */}
      <InfoComment label="Commentaires véhicule" text={vehicle.accessoires} />
      <InfoComment
        label="Commentaires complémentaire"
        text={pricing.commentaires}
      />
    </InfoCard>
  );
}
```

- [ ] **Step 2: Fix the imports**

At the top of the same file, add the new component and the three helpers:

```tsx
import InfoCollapsibleRow from "@/components/ui/InfoCollapsibleRow";
```

and extend the existing `@/lib/ui/format` import block to:

```tsx
import {
  dash,
  euros,
  hasMateriel,
  isOui,
  kilometres,
  ouiNon,
  regionLabel,
  statusLabel,
  submittedAt,
  viewerStatus,
} from "@/lib/ui/format";
```

`DossierCard`, `SellerCard`, `LoadedDossier` and the default export are unchanged.

- [ ] **Step 3: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all three green.

- [ ] **Step 4: Verify in the app**

```bash
npx expo run:android
```

On a dossier that has keys and a contrôle technique, as **both** a b2b and a back-office
user, confirm:

1. All eleven parts render, hairline-separated, in the order in the table above.
2. Each collapsible expands and collapses; the chevron rotates to point down and back.
3. A row whose answer is "non" or "—" shows **no** button.
4. A key count of `0` reads `"0"`, not `"—"`.
5. "Nature de la panne" appears only when État is "En Panne".
6. The chevron glyph is charcoal (`primary`) like the phone/mail icons — `chevron-right.svg`
   is stroke-based where `mail.svg` is fill-based, so confirm `tintColor` lands on it.

- [ ] **Step 5: Update the page spec**

In `docs/specs/page-dossier.md`, replace the four-line "Four parts :" list under
`### "Informations véhicule"` with:

```markdown
Eleven parts, identical for both roles — nothing in this card branches on role.

1. Liste d'information : prix souhaité, marque, modèle et cylindrée, année, kilométrage.
2. Repliable : électrique → batterie présente, chargeur présent.
3. Liste d'information : état.
4. Comments : nature de la panne — **only when l'état est "En Panne"**.
5. Repliable : carte grise → à votre nom.
6. Repliable : contrôle technique → moins de 6 mois, résultat obtenu.
7. Liste d'information : certificat de non-gage, carnet d'entretien, facture d'entretien.
8. Repliable : clés de contact → clé noire, clé marron, clé rouge.
9. Repliable : télécommande ou Bip → nombre.
10. Comments : commentaires véhicule.
11. Comments : commentaires complémentaire.

Every repliable part ([`InfoCollapsibleRow`](component-info-card.md)) is collapsible only
when its own answer is "oui" — the funnel leaves each sub-answer `null` otherwise, so
there would be nothing to reveal. A "non" or "—" answer renders as a plain row with no
button, keeping its own hairlines so the card's shape is the same for every dossier.

"Modèle et Cylindrée" is a single row, mirroring the B2B submission form — which is the
only source of dossiers — where both are one field (`vehicle.modele`).

"Commentaires véhicule" is `vehicle.accessoires`, which holds the funnel's step-2
free-text "Commentaires (Ex. État de la moto)". The B2B funnel collects no accessories,
so the row is labelled for what the field actually contains; there is no "Accessoires"
row.
```

(The paragraph about "Modèle et Cylindrée" already exists directly below the old list —
fold it in as shown rather than leaving a duplicate.)

- [ ] **Step 6: Commit**

```bash
git add src/components/screens/DossierDetailScreen.tsx docs/specs/page-dossier.md
git commit -m "feat(dossier): show every vehicle answer the funnel collects"
```

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: the `InfoCollapsibleRow` API,
collapsed appearance, button, animation, sub-rows and a11y → Task 2; the eleven-part table
and its four "easy to get wrong" details (prix souhaité moved, `"En Panne"` capital P,
`isOui` gating, `dash(0)`) → Task 3; the three helpers → Task 1; both doc updates → folded
into the tasks that change their features; the chevron asset → Task 2 Step 5; the
verification commands → the Global Constraints plus each task's gate step. The
"Accessoires" decision is realised as Task 3's "Commentaires véhicule" row and its comment.
The spec's out-of-scope items generate no task, by design.

**Type consistency.** `isOui` / `ouiNon` / `hasMateriel` carry the same signatures in Task
1's Interfaces block, its implementation, and Task 3's call sites. `InfoRow` is the tuple
already exported by `InfoRows.tsx`. `IconButton`'s new props (`iconStyle`, `expanded`) are
defined in Task 2 Step 1 and used in Task 2 Step 2 only.

**One deviation from the spec, deliberate.** The spec names only `iconStyle` on
`IconButton`; the plan also adds an optional `expanded` prop, because
`accessibilityState={{ expanded }}` belongs on the `Pressable` that `IconButton` owns and
cannot be passed in from outside.
