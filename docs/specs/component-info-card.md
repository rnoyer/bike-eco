# `InfoCard` component

The read-only information card: a dark title bar under a green brand rule, over a white
body split into **parts** separated by hairline dividers. It is the single source of truth for every
label/value block in the app — "Mes informations personnelles", "Informations véhicule",
"Informations vendeur", "Informations Dossier", "Information Entreprise",
"Information collaborateur".

It **replaces** [`Section`](component-section.md) for these blocks: the title bar *is* the
title, so a card is never nested inside a `Section` of the same name. `Section` stays for
button groups ("Actions sur mon compte", "Gérer ce collaborateur") and lists of cards
("Vendeurs de cette entreprise").

## Card

### Props

- `title: string` — rendered in the dark title bar (`primary` background, `primaryText`,
  15px/600), closed by a 3px `brand` rule along its bottom edge. That rule is the card's
  brand moment: the body below it stays neutral.
- `loading?: boolean` — centered spinner in the body, under the bar.
- `error?: string | null` — already-French copy from the read hook (`mapDataError`), shown
  in `danger` in place of the parts.
- `emptyMessage?: string` — muted message when the card has no parts. Omit for cards whose
  content is always present.
- `children?: ReactNode` — the parts.

### Behavior

- Precedence, identical to `Section`: `loading` → `error` → empty + `emptyMessage` →
  parts. **`error` outranks `emptyMessage` on purpose** — a denied or offline read must not
  read as "there is nothing here".
- The **card** draws the dividers, between consecutive parts, in `tokens.colors.border` —
  not `divider`, which is ~1.07:1 on white and would make the separating lines, the whole
  point of the card, invisible. Parts never draw their own,
  so any part can be first, last or only without a conditional.
- `null` children are dropped (by `Children.toArray`) before the dividers are computed, so
  a conditionally-absent part never leaves a doubled line behind.
- The body is clipped (`overflow: hidden`) to the card radius, so the square title bar
  takes the card's rounded top corners — and the header's `brand` rule with it.

## Parts

Three kinds, all in `src/components/ui/`.

### `InfoRows` — liste d'information

```tsx
<InfoRows rows={[["Entreprise", "Garage du Sud"], ["SIRET", "98765432100022"]]} />
```

One row per pair: a bold label with a trailing `" :"`, then the value flowing directly
after it, left-aligned and wrapping.

The value is **not** right-aligned with a flexible spacer. Left flow lets a long value wrap
under itself instead of squeezing the label off-screen.

- Empty values render `"—"` (`dash()` in `src/lib/ui/format.ts`) — never `"null"`, never a
  blank row.
- **Units live in the value** — `"48000 km"`, `"2400 €"` — and an absent field is dashed
  rather than rendered as a bare unit. `format.ts` owns the formatters (`euros`,
  `kilometres`, `regionLabel`, `statusLabel`, `submittedAt`).
- Optional rows are omitted by the caller, not rendered empty.

### `InfoContactRow` — information avec action button

```tsx
<InfoContactRow kind="phone" value={submitter.telephone} />
<InfoContactRow kind="email" value={submitter.email} />
```

A label/value row whose value is followed by a right-aligned icon button opening the OS
dialer or mail client.

`kind` derives everything — the label ("Téléphone" / "Email"), the icon
(`assets/images/icons/phone.svg` / `mail.svg`), the URL scheme (`tel:` / `mailto:`) and the
French accessibility label ("Appeler …" / "Écrire à …"), which an icon-only button needs to
be reachable by a screen reader at all.

- The `tel:` href strips spaces; the **displayed** value keeps its formatting.
- The button is **always** rendered when there is a value. It is deliberately not gated on
  `Linking.canOpenURL`: on Android that check is filtered by package visibility from API 30
  up, so it answers `false` for `tel:` / `mailto:` and the button disappears on device
  while still showing on web. Package visibility does not restrict `startActivity`, so
  `openURL` works. On Android and on a real iOS device a genuine "no app can open this"
  rejects and surfaces a French dialog ("Aucune application de téléphone n'est disponible
  sur cet appareil."). Two platforms can't reach it and tap silently: react-native-web
  resolves `openURL` unconditionally (`window.open` never throws), and the iOS simulator
  resolves `NO` for `tel:` rather than rejecting. Both are dev/browser-only degradations.
- An empty value renders `"—"` and no button.
- The button is a 22px icon inside `space.sm` padding on a **filled `brand` background**
  with a `radius.sm` corner, tinting to `brandPressed` while pressed. Filled, not outlined:
  the previous hairline box around a dark glyph read as a disabled placeholder rather than
  as the row's one action, and its `surfaceAlt` pressed state was a ~1.02:1 change. The
  glyph stays `primary` — charcoal on green is the logo's own pairing, at 6.3:1.

Used for a **contact you can reach**. "Mon compte" shows the viewer's own number and
address as plain `InfoRows` — calling yourself is pointless.

### `InfoComment` — comments

```tsx
<InfoComment label="Commentaires" text={pricing.commentaires} />
```

A bold label with `" :"` on its own line, then the free text full-width beneath it (14px,
20px line height). Free-text fields get the whole card width instead of competing with a
label on one line.

Empty text renders `"—"` under the label, keeping the part's height stable.

## Callers

| Screen | Card | Parts |
|---|---|---|
| [My account](page-my-account.md) | "Mes informations personnelles" | Nom · Prénom · Email · Téléphone |
| My account (B2B only) | "Informations {entreprise}" | SIRET · N° TVA · Département · Ville |
| [Dossier](page-dossier.md) | "Informations Dossier" | Date de soumission · Statut · Prix négocié · Région |
| Dossier | "Informations véhicule" | rows · Accessoires · rows · Commentaires |
| Dossier | "Informations vendeur" | rows · Téléphone · Email |
| [Company](page-company.md) | "Information Entreprise" | Entreprise · SIRET · N° TVA · Département · Ville · Région |
| [Colleague](page-colleague.md) | "Information collaborateur" / "Informations vendeur" | Nom · Prénom · Rôle · Téléphone · Email |

## Layout

Cards are spaced by [`SectionWrapper`](component-section-wrapper.md), the same container
that owns the screen padding and the gap between `Section`s.
