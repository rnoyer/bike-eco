# Generic `Section` component

A titled block of content with a shared title / loading / empty look. It is the single
source of truth for the "section" appearance used across the app (dashboards, back-office
company list & detail, account, settings, dossier detail).

## Props

- `title: string` — the section heading (18px bold, primary color).
- `loading?: boolean` — when `true`, shows a centered spinner under the title.
- `emptyMessage?: string` — when the section has no children, shows this muted message
  instead of the (empty) list. Omit it for sections whose content is always present.
- `children?: ReactNode` — the section content, rendered in a vertical `gap` list.

## Behavior

- **Empty = no children.** Emptiness is `React.Children.count(children) === 0`; there is no
  `isEmpty` prop. Callers with a possibly-empty list pass the mapped array (`items.map(...)`),
  so `[]` renders `emptyMessage`. Always-present sections pass their content and omit
  `emptyMessage`.
- Precedence: `loading` → spinner; else empty + `emptyMessage` → the message; else the list.

## Callers

`DossiersSection` and `CompaniesSection` are thin wrappers over `Section` (they keep their
own `dossiers`/`companies` + `renderCard` prop shape and pass `{items.map(renderCard)}` as
children). The account, settings, dossier-detail, and back-office company-detail screens use
`Section` directly for their titled blocks.

## Layout

Sections are spaced by the [`SectionWrapper`](component-section-wrapper.md) container, which
owns the screen padding and the gap between sections and other top-level blocks.
