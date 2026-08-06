# Information cards — design

Replaces every read-only "label / value" section in the app with a single card
component: a dark title bar over a white body, whose body is split into parts
separated by hairline dividers.

## Why

Three problems with what exists today:

1. The four `src/components/native/*InfoList.tsx` are `@expo/ui` (`Row` +
   `Spacer(flexible)`), a single-line right-aligned layout. A long
   `commentaires` or `accessoires` value fights the label for width and
   overflows — already noted as a known defect in the `bike-eco-ui` skill.
2. There is no way to act on a phone number or an email address; they render as
   inert text.
3. A dossier's own metadata (status, negotiated price, region) is not shown on
   the dossier page at all — it only exists on the back-office management form.

## Decisions taken

| Question | Decision |
|---|---|
| Palette | Reuse `tokens.colors.primary` (`#111`). No new colour tokens. |
| Rendering layer | React Native. The four `@expo/ui` info lists are deleted. |
| Relationship to `Section` | The card **replaces** `Section` for these blocks — its title bar *is* the title. `Section` stays for button groups and card lists. |
| `Statut` value | Plain text (`À traiter` / `En cours` / `Clôturé`), not a `StatusBadge`. |
| `Entreprise` on the back-office user detail | Dropped — `users/{uid}` has only `companyId`, and that screen is reached from the company page. |
| Drop shadow from the mockups | Not shipped. `tokens` has no shadow entry; border-only, like `EntityCard`. |
| Contact rows on "Mon compte" | Plain rows, no action buttons — it is the viewer's own number. |

## Components

All four are new, in `src/components/ui/`, RN + `tokens`.

### `InfoCard`

```tsx
<InfoCard title="Informations véhicule" loading={…} error={…}>
  {…parts…}
</InfoCard>
```

The shell.

- **Title bar** — `tokens.colors.primary` background, `tokens.colors.primaryText`
  at 15px/600, `space.md` padding.
- **Body** — `tokens.colors.surface`, wrapped in `tokens.colors.border` at
  `tokens.radius.md` with `overflow: "hidden"` so the bar clips to the top
  corners.
- **Dividers** — the card inserts a 1px `tokens.colors.divider` line *between*
  its children. Parts never draw their own separator, so any part can be first,
  last, or only, without a conditional.
- `loading` / `error` follow `Section`'s precedence (`loading` → spinner;
  else `error` → `danger` text; else children). Only "Informations {company}" on
  `AccountScreen` needs them; both props are optional.

Children are filtered for `null` before dividers are computed, so a
conditionally-absent part does not leave a doubled line.

### `InfoRows` — "liste d'information"

```tsx
<InfoRows rows={[["Entreprise", "Garage du Sud"], ["SIRET", "98765432100022"]]} />
```

One row per pair: a bold label with a trailing `" :"`, then the value flowing
directly after it (`space.sm` gap), left-aligned and wrapping.

This is the substantive change from the old lists, which right-aligned the value
with a flexible spacer. Left flow means a long value wraps under itself instead
of squeezing the label off-screen.

- Label: 14px/700, `tokens.colors.primary`.
- Value: 14px/400, `tokens.colors.primary`, `flexShrink: 1`.
- Empty values render `dash()` — `"—"`, never `"null"` or a blank row.
- Units live in the value: `${kilometrage} km`, `${prix} €`, and the field is
  dashed when absent rather than rendered as a bare unit.

### `InfoContactRow` — "information avec action button"

```tsx
<InfoContactRow kind="phone" value={submitter.telephone} />
<InfoContactRow kind="email" value={submitter.email} />
```

A row whose value is followed by a right-aligned icon button.

`kind` derives everything: the label (`"Téléphone"` / `"Email"`), the icon
(`assets/images/icons/phone.svg` / `mail.svg`, both already in the repo, drawn
with `expo-image` + `tintColor` like `HeaderBackButton`), and the href
(`tel:` / `mailto:`).

- The `tel:` href strips spaces from the number; the **displayed** value keeps
  its formatting.
- `Linking.canOpenURL` is checked in an effect; the button is only rendered when
  it resolves `true`. A simulator or a tablet with no dialer therefore shows a
  plain row rather than a dead tap.
- An empty value renders `dash()` and no button.
- The button is a `Pressable` with `hitSlop`, `accessibilityRole="button"` and a
  French `accessibilityLabel` (`"Appeler {value}"` / `"Écrire à {value}"`). It is
  an icon-only affordance, so it needs the label to be reachable at all by a
  screen reader.

### `InfoComment` — "comments"

```tsx
<InfoComment label="Commentaires" text={pricing.commentaires} />
```

A bold label with `" :"` on its own line, then the full-width paragraph beneath
it at 14px/400 with a 20px line height. Free text gets the whole card width
instead of competing with a label on one line.

An empty text renders `dash()` under the label — consistent with every other
absent value in the app, and it keeps the part's height stable.

## Shared helpers

`src/lib/ui/format.ts` — new, pure, unit-tested.

- `dash(v: unknown): string` — `"—"` for `null` / `undefined` / `""`, else
  `String(v)`. Currently duplicated verbatim in `DossierInfoList` and
  `UserInfoList`.
- `submittedAt(ts: Timestamp | null): string` — `"26 juil. 2026 14:30"`. Moved
  out of `UserInfoList`.
- `euros(n: number | null): string` — `"2400 €"` or `"—"`.
- `kilometres(n: number | null): string` — `"48000 km"` or `"—"`.
- `regionLabel(r: Region): string` — `"Nord"` / `"Sud"`. Currently inline in
  `CompanyInfoList`.
- `statusLabel(s: DossierStatus): string` — `"À traiter"` / `"En cours"` /
  `"Clôturé"`. The same three strings `StatusBadge` holds; `StatusBadge` is
  refactored to read them from here so the two cannot drift.

Pure logic is the tested layer in this repo (`docs/tech/verification.md`), so
this file gets `src/lib/ui/__tests__/format.test.ts` and the components do not
get render tests.

## Screens

### `AccountScreen` — both roles

1. `InfoCard "Mes informations personnelles"` — one `InfoRows`: Nom, Prénom,
   Email, Téléphone.
2. B2B only (`data.companyId`): `InfoCard "Informations {company.name}"`, with
   the card's `loading` / `error` fed from `useCompany` — one `InfoRows`: SIRET,
   Département, Ville. Falls back to `"Informations entreprise"` before the name
   resolves, as today.
3. `Section "Actions sur mon compte"` — unchanged.
4. The bottom-pinned "Supprimer mon compte" block — unchanged.

### `DossierDetailScreen`

Gains one prop, `role: "b2b" | "backoffice"`, which drives **card order only**.
Both routes (`(b2b)/dossier/[id]/index.tsx`,
`(backoffice)/dossier/[id]/index.tsx`) pass it.

- b2b: **Informations Dossier**, Informations véhicule, Informations vendeur.
- back-office: Informations véhicule, Informations vendeur, **Informations
  Dossier**.

The photo carousel and the `{marque} {modele}` heading stay above the cards.

**`InfoCard "Informations Dossier"`** — new. One `InfoRows`:

| Row | Source |
|---|---|
| Date de soumission | `submittedAt(dossier.createdAt)` |
| Statut | `statusLabel(dossier.status)` |
| Prix négocié | `euros(dossier.negotiatedPrice)` |
| Région | `regionLabel(dossier.region)` |

It reads from the live `useDossier` snapshot, so a back-office update to status,
negotiated price or region re-renders it with no extra wiring.

**`InfoCard "Informations véhicule"`** — four parts:

1. `InfoRows`: Marque, Modèle et Cylindrée, Année, Kilométrage, Électrique.
2. `InfoComment` "Accessoires".
3. `InfoRows`: État, Carte grise, Contrôle technique, Prix souhaité.
4. `InfoComment` "Commentaires".

"Modèle et Cylindrée" stays one row: the B2B funnel — the only source of
dossiers — collects both in the single `vehicle.modele` field.

**`InfoCard "Informations vendeur"`** — three parts:

1. `InfoRows`: Entreprise, Nom, Prénom.
2. `InfoContactRow` phone.
3. `InfoContactRow` email.

`Date de soumission` **moves out of this card** into "Informations Dossier".
Email and téléphone are still read from the denormalized `dossier.submitter`,
never from `users/{uid}`: a deleted colleague's user doc is removed while their
dossiers are kept, so the denormalized copy is the only value guaranteed to
still exist.

### `(backoffice)/companies/[id].tsx`

`Section "Information Entreprise"` becomes `InfoCard "Information Entreprise"`
with one `InfoRows`: Entreprise, SIRET, Département, Ville, Région. The pending
approve/decline block, the "Vendeurs de cette entreprise" list and the manage
block stay as `Section`s.

### `ColleagueScreen`

`Section {infoTitle}` becomes `InfoCard {infoTitle}` with three parts:

1. `InfoRows`: Nom, Prénom, Rôle (`roleLabel`).
2. `InfoContactRow` phone.
3. `InfoContactRow` email.

Both modes use the same card. The back-office read-only mode keeps its
`"Informations vendeur"` title and, per the decision above, gains no
`Entreprise` row. `Section "Gérer ce collaborateur"` is unchanged.

## Deletions

`src/components/native/AccountInfoList.tsx`, `CompanyInfoList.tsx`,
`DossierInfoList.tsx`, `UserInfoList.tsx` — and the now-empty
`src/components/native/` directory.

`CompanyInfoList`'s `showName` / `showRegion` props disappear with it: each
caller now passes the rows it wants. `AccountScreen` omits Entreprise and
Région; the company page includes both.

This leaves `ChatComposer`'s attachment `BottomSheet` as the app's only remaining
`@expo/ui` usage. (`NativeTabs` comes from `expo-router/unstable-native-tabs` and is
unrelated to `@expo/ui`.)

## Docs kept in sync, same change

- `docs/specs/component-info-card.md` — new; the component's contract.
- `docs/specs/page-dossier.md` — the three cards, the new "Informations
  Dossier", and `Date de soumission` moving out of "Informations vendeur".
- `docs/specs/page-my-account.md` — sections become cards.
- `docs/specs/page-colleague.md` — the three parts, and the tappable contacts.
- `docs/specs/page-company.md` — "Information Entreprise" becomes a card.
- `docs/specs/component-section.md` — its caller list names the account,
  dossier-detail and company-detail screens as `Section` users for their
  label/value blocks; that is no longer true.
- `.claude/skills/bike-eco-ui/SKILL.md` — the two-layer table, the whole "Info
  lists" section, the "Tappable phone / email" note, and the common-mistakes
  rows about `@expo/ui` all describe code that will no longer exist.

## Verification

`npx tsc --noEmit && npx expo lint && npm test`, per `docs/tech/verification.md`.
No route files are added, so no typed-routes regeneration is needed. No native
module is added, so no dev-client rebuild is needed.
