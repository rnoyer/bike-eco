# Generic `Section` component

A titled block of content with a shared title / loading / error / empty look, used for
**button groups and lists of cards** (dashboards, back-office company list & detail,
settings, "Actions sur mon compte", "Gérer ce collaborateur").

Read-only label/value blocks are **not** `Section`s — they are
[`InfoCard`](component-info-card.md)s, whose dark title bar replaces the section title.

## Props

- `title: string` — the section heading (18px bold, primary color).
- `loading?: boolean` — when `true`, shows a centered spinner under the title.
- `error?: string | null` — already-French copy from the read hook (`mapDataError`). Shown
  in `danger` in place of the list. A section never renders a raw Firebase code, and never
  invents its own wording.
- `emptyMessage?: string` — when the section has no children, shows this muted message
  instead of the (empty) list. Omit it for sections whose content is always present.
- `children?: ReactNode` — the section content, rendered in a vertical `gap` list.

## Behavior

- **Empty = no children.** Emptiness is `React.Children.count(children) === 0`; there is no
  `isEmpty` prop. Callers with a possibly-empty list pass the mapped array (`items.map(...)`),
  so `[]` renders `emptyMessage`. Always-present sections pass their content and omit
  `emptyMessage`.
- Precedence: `loading` → spinner; else `error` → the error message; else empty +
  `emptyMessage` → the message; else the list.
- **`error` outranks `emptyMessage` on purpose.** A denied or offline read returns an empty
  array, so without this a failure reads as "vous n'avez pas de dossier" — the user is told
  their data doesn't exist rather than that it couldn't be fetched.

For a whole screen with nothing to show, the equivalents are `ui/Spinner`'s `ScreenLoader`
and `ui/ScreenMessage`.

## Callers

`DossiersSection` and `CompaniesSection` are thin wrappers over `Section` (they keep their
own `dossiers`/`companies` + `renderCard` prop shape and pass `{items.map(renderCard)}` as
children). The account, settings, colleague and back-office company-detail screens use
`Section` directly for their button groups and card lists — but their label/value blocks
are `InfoCard`s.

## Layout

Sections are spaced by the [`SectionWrapper`](component-section-wrapper.md) container, which
owns the screen padding and the gap between sections and other top-level blocks.
