# `SectionWrapper` — pure padding/gap layout container — design

**Date:** 2026-07-24 · **Branch:** `feat/back-office-validation-UI` · **Status:** Approved (brainstorm) — ready to implement

> Follows the `Section` component (see `2026-07-24-section-component-design.md`, shipped as
> commit `4e1bf3e`). This adds a companion layout container so the **gap between sections**
> (and other top-level blocks) is defined once instead of being re-declared on every screen's
> `ScrollView`.

## Goal

Today each screen sets the vertical rhythm itself — `contentContainerStyle: { padding: lg,
gap: xl }` is copy-pasted across Dashboard, companies list, companies detail, and Account;
Settings uses `gap: md`; DossierDetail uses a bespoke padded inner `View`. Introduce a single
`SectionWrapper` that owns the canonical screen padding + inter-block gap, and adopt it on all
six section-bearing screens.

## Locked decisions (from brainstorm)

1. **Pure layout `View`, not a `ScrollView`.** The wrapper does not scroll. It is nestable and
   can be placed anywhere — each screen keeps its own `ScrollView` (or plain `View`) and puts
   `SectionWrapper` inside. This is what lets DossierDetail keep a full-bleed carousel (see #5).
2. **It owns padding + gap:** `{ padding: tokens.space.lg, gap: tokens.space.xl }`. Screens
   that adopt it **drop `padding`/`gap` from their own `contentContainerStyle`** so we never
   double-pad.
3. **Holds any block-level children**, not only `Section`s — fields (the Settings région
   `Dropdown`), banners (`PendingCompaniesBanner`), CTAs, headings, info lists. Everything
   placed directly inside gets the shared `xl` gap.
4. **Canonical values: gap `xl`, padding `lg`.** Four screens already use these; Settings'
   inter-block spacing moves `md` → `xl` for consistency (an accepted small visual change).
5. **All six screens adopt it:** Dashboard, companies list, companies detail, Account,
   Settings, DossierDetail. DossierDetail's full-bleed `PhotoCarousel` stays **outside** the
   wrapper (a direct child of the screen's `ScrollView`, so it keeps its edge-to-edge width and
   scrolls with the content as it does today); only the padded heading + Informations section
   go inside `SectionWrapper`.

## Design

### New `src/components/ui/SectionWrapper.tsx`

```tsx
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "@/theme/tokens";

export default function SectionWrapper({ children }: { children: ReactNode }) {
  return <View style={styles.wrapper}>{children}</View>;
}

const styles = StyleSheet.create({
  wrapper: { padding: tokens.space.lg, gap: tokens.space.xl },
});
```

Single `children` prop — no style override (YAGNI; add one only if a real need appears).

### Per-screen adoption

For each screen: keep the `ScrollView`/`View`, remove `padding` and `gap` from its
`content`/`contentContainerStyle`, and wrap the block-level children in `<SectionWrapper>`.
Screen-specific styles that aren't padding/gap (e.g. the Dashboard `cta`/`ctaText`, the
company-detail `row`/`danger`/modal styles, the dossier `heading`) stay on the screen.

- **`src/components/screens/DashboardScreen.tsx`** — both role branches: wrap the
  banner/CTA + `DossiersSection`s in `SectionWrapper`; strip `padding`/`gap` from `content`
  (keep `cta`/`ctaText`).
- **`src/app/(backoffice)/companies/index.tsx`** — wrap the two `CompaniesSection`s; `content`
  becomes empty (delete the style, use `SectionWrapper` as the sole child of the `ScrollView`).
- **`src/app/(backoffice)/companies/[id].tsx`** — wrap the `Section`s (and the `Modal` can stay
  a sibling outside the wrapper, or inside — it's `position`-absolute visually via `transparent`,
  so keep it **outside** `SectionWrapper` as a direct `ScrollView` child to avoid it picking up
  gap/padding). Strip `padding`/`gap` from `content`.
- **`src/components/screens/AccountScreen.tsx`** — wrap the three `Section`s; strip
  `padding`/`gap` from `content`.
- **`src/components/screens/SettingsScreen.tsx` + `src/components/form/SettingsList.tsx`** —
  `SettingsList` returns `<SectionWrapper>{Dropdown + Sections}</SectionWrapper>` (its own
  `container` `View`/`gap` is removed). `SettingsScreen`'s `ScrollView` drops its `padding`.
- **`src/components/screens/DossierDetailScreen.tsx`** — keep the `ScrollView`; the
  `PhotoCarousel` stays a direct child (full-bleed). Wrap the heading + `Section` in
  `SectionWrapper` (replacing the current `list` `View`). Remove the `list` padded style
  (its `padding: lg, gap: md` is now the wrapper's job) and the `content`
  `contentContainerStyle`'s `paddingBottom` (covered by the wrapper's bottom padding); keep
  `heading` and the spinner styles. The `ScrollView` itself stays.

### Modal / non-flow children

The company-detail `Modal` and any overlay stay **outside** `SectionWrapper` so they don't
receive the padding/gap. `SectionWrapper` is for the in-flow, stacked content only.

## Spec sync (same change)

- Add `docs/specs/component-section-wrapper.md` (props `children`; owns screen padding `lg` +
  inter-block gap `xl`; a non-scrolling layout `View`; holds any block children).
- Cross-link it from `docs/specs/component-section.md` (Section is the titled block;
  SectionWrapper is the spacing container that holds them).

## Verification

`npx tsc --noEmit && npx expo lint && npx jest` — all must pass (currently 123/123 client).
No new unit tests (presentational layout component; no existing render tests). Behavior of the
list sections is unchanged. Optional manual check on the running emulator (bo@bike-eco.fr /
password123): every screen keeps consistent spacing; DossierDetail's carousel is still
full-bleed and scrolls with the content; Settings' blocks are now `xl`-spaced.

## Process

Implement directly (small, mechanical — ~8 files). One focused commit, e.g.
`feat(ui): SectionWrapper layout container; adopt across section screens`. Then **stop for the
user to review** — do not merge or push (the branch is being manually tested first).

## Out of scope / non-goals

- No pinned/sticky carousel or parallax on DossierDetail (explicitly rejected — the carousel
  scrolls with content as today).
- No `style`/gap-size props on `SectionWrapper` (YAGNI).
- No changes to `Section`, the info-list components, or any form/data logic.
