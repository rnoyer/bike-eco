# `SectionWrapper` layout container

A non-scrolling layout `View` that owns the app's canonical screen padding and the vertical
gap between top-level blocks. It is the single source of truth for that spacing, so screens
no longer re-declare `padding`/`gap` on their own `ScrollView`.

## Props

- `children: ReactNode` — any block-level content: `Section`s, form fields (e.g. the Settings
  région `Dropdown`), banners, CTAs, headings. Direct children are spaced by the shared gap.

## Layout

- `{ padding: tokens.space.lg, gap: tokens.space.xl }`. No other style/props (YAGNI).
- **Does not scroll** — it is a `View`, so it nests anywhere: each screen keeps its own
  `ScrollView`/`View` and drops padding+gap from that container. This is what lets
  DossierDetail keep a full-bleed `PhotoCarousel` (outside the wrapper) above padded content.

## Not for

- Overlays/`Modal`s and full-bleed media stay outside the wrapper so they don't inherit its
  padding/gap. It wraps the in-flow, stacked content only.
