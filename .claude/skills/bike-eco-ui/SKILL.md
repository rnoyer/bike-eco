---
name: bike-eco-ui
description: >-
  Use when building or restyling any screen, component, list, card, badge, modal
  or layout in the bike-eco Expo app — an info list of label/value rows, a
  tappable phone number or email address, text that overflows or needs truncating,
  a section header, a status badge, a dossier or company card, an error or
  confirmation modal, a spinner or empty state, or any colour, spacing, radius or
  font-size decision.
---

# UI in bike-eco

One rendering layer, one token set. Read the matching `docs/specs/page-*.md` or
`component-*.md` before building — they are the source of truth for layout and French
copy. Gate with `docs/tech/verification.md`.

## One layer: React Native + tokens

Everything in `src/components/ui/` and `src/components/form/` is React Native styled from
`@/theme/tokens`. There is no second component layer.

`@expo/ui` is **not a layer you build screens or components in**. Its one remaining use is
`ChatComposer`'s attachment `BottomSheet` — leave that alone; it is not a convention
violation. (The tab bars are `NativeTabs` from `expo-router/unstable-native-tabs`, which is
unrelated to `@expo/ui`.)

The info lists that used to live in `src/components/native/` were replaced by `InfoCard`
(see below) precisely because `@expo/ui`'s `Row` + `Spacer(flexible)` can't do dividers,
icon buttons, or a value that wraps instead of squeezing its label.

## Tokens are the only source of style

`src/theme/tokens.ts` holds colours, spacing, radius, button height, title/subtitle text
styles, and the per-status badge palette. Never hardcode a hex or spacing value a token
covers.

```ts
colors: primary #111 · primaryText #fff · muted #71727A · border #E5E7EB
        divider #F3F4F6 · disabled #C1C1C6 (also placeholder) · surfaceAlt #FAFAFA
        surface/bg #fff · danger #9F0712 · success #16A34A
status: a_traiter (amber) · en_cours (blue) · cloture (green)   // keyed by DossierStatus
radius: sm 8 · md 12 · lg 16        space: xs 4 · sm 8 · md 12 · lg 24 · xl 28
```

`tokens.status` is keyed by `DossierStatus`, so adding a status means adding its palette
entry — `StatusBadge` reads it directly.

## Info cards

**Every read-only label/value block in the app is an `InfoCard`** — a dark title bar over
a white body split into parts by hairline dividers. Full contract in
`docs/specs/component-info-card.md`. Three part components:

| Part | For |
|---|---|
| `InfoRows` | `rows: [label, value][]` — the liste d'information |
| `InfoContactRow` | `kind="phone" \| "email"` — value plus a right-aligned action button |
| `InfoComment` | Free text (commentaires, accessoires) full-width below its label |

Rules that must survive any restyle:

- **`InfoCard` replaces `Section`** for these blocks — its title bar *is* the title. Never
  nest a card in a `Section` of the same name. `Section` is for button groups and card
  lists. `InfoCard` mirrors `Section`'s `loading` / `error` / `emptyMessage` precedence.
- **The card draws the dividers**, between consecutive parts. A part never draws its own,
  and `null` children are dropped first — so a conditional part can't leave a doubled line.
- **Values flow left after the label**, not right-aligned with a flexible spacer. This is
  the whole reason the `@expo/ui` lists were replaced: a right-aligned `commentaires`
  squeezed its label and overflowed. Long values wrap under themselves.
- **Free text is an `InfoComment`, never a row.** Plus a character cap on the input side
  (`bike-eco-forms`).

### Formatting lives in `src/lib/ui/format.ts`

The only place that formats a value for display, and the app's one unit-tested UI module:

- **`dash()`** renders `"—"` for `null` / `undefined` / `""`. Never print "null" or an
  empty row. `InfoRows`, `InfoContactRow` and `InfoComment` all apply it themselves.
- **Units live in the value** — `euros()` → `"2400 €"`, `kilometres()` → `"48000 km"` —
  and an absent field is dashed, not rendered as a bare unit.
- `submittedAt()`, `regionLabel()`, `statusLabel()`. `STATUS_LABELS` is shared with
  `StatusBadge` so the badge and the "Statut" row cannot drift.
- **Optional rows are omitted by the caller**, not rendered empty. There are no
  `showX` props on the parts.

### Tappable phone / email

`InfoContactRow` already owns this; don't hand-roll it. It strips spaces from the `tel:`
href while leaving the displayed value formatted, and carries a French
`accessibilityLabel` because an icon-only button is otherwise unreachable by a screen
reader.

**Never gate the button on `Linking.canOpenURL`.** On Android that call is
`Intent.resolveActivity`, which package visibility filters from API 30 up unless the app
declares a `<queries>` entry for the scheme — and nothing in this app's plugin set
declares `tel:` or `mailto:`, so it answers `false` and the button disappears on device
while still showing on web (react-native-web resolves it `true` unconditionally). This
shipped as a bug once.

Package visibility restricts *querying*, not `startActivity` — so `openURL` works
regardless. Render the affordance and handle the real failure in the promise rejection
(`alertDialog` with French copy). That rejection fires on Android and on a real iOS
device; react-native-web always resolves and the iOS simulator resolves `NO` for `tel:`,
so those two tap silently — acceptable, since both are dev/browser-only. The same
reasoning applies to any future `tel:`, `mailto:`, `sms:` or third-party-app deep link.

Use it for a contact you can **reach**. "Mon compte" shows the viewer's own number and
address as plain `InfoRows`.

## Shared components

| Component | Notes |
|---|---|
| `ui/InfoCard` + `ui/InfoRows`, `ui/InfoContactRow`, `ui/InfoComment` | Every read-only label/value block — see "Info cards" above |
| `ui/Section` | Title + `loading` + `error` + `emptyMessage` + children, for **button groups and card lists**. Owns all four states in that precedence — don't reimplement them per screen |
| `ui/Spinner` | The **only** spinner. Never render a bare `ActivityIndicator`: this owns the token colour. `ScreenLoader` (named export) is the centred whole-screen/region variant |
| `ui/ScreenMessage` | Screen-level counterpart to `Section`'s error/empty states: `message` + `tone` (`muted` \| `danger`) |
| `ui/SectionWrapper` | Layout shell around sections |
| `ui/DossiersSection`, `ui/CompaniesSection` | Per-section fetch + `Section` |
| `ui/DossierCard`, `ui/CompanyCard` | Thin wide cards; see their component specs |
| `ui/StatusBadge` | Reads `tokens.status` by `DossierStatus`, and its copy from `lib/ui/format`'s `STATUS_LABELS` |
| `ui/Button` | The only button. Never hand-roll a `Pressable` with its own styling. `loading` swaps the label for a spinner and blocks presses; `disabled` only dims. `loading` wins — a spinning button is never also dimmed |
| `ui/ImageViewerModal` | Full-screen modal precedent — wraps content in its own `GestureHandlerRootView` |
| `ui/ConfirmationView` | Success screen with delayed auto-redirect |

**Modals:** `ImageViewerModal` is the pattern to follow for a new modal (an auth-failure
dialog, a confirmation prompt). A modal that hosts gesture-driven content needs its own
`GestureHandlerRootView` inside the modal — the root one doesn't reach across the portal.

**Dialogs:** use `confirmDialog` / `alertDialog` from `lib/ui/dialog`, never `Alert.alert`
directly — react-native-web ships `Alert.alert` as an empty function, so a native-only
prompt silently does nothing in a browser. `confirmDialog` takes `destructive` for the
platform's red confirm style.

## Loading states

Every user-initiated async action shows that it is working. The primitive is
**`useAsyncAction`** (`src/lib/ui/useAsyncAction.ts`) — reach for it instead of a local
`busy` boolean:

```ts
const inviting = useAsyncAction(callSendInvite, {
  mapError: frenchAuthMessage,                    // omit for the data layer's French Errors
  onError: (message) => alertDialog("Erreur", message),
});
<Button label="Envoyer" loading={inviting.pending} onPress={() => void inviting.run(email)} />
```

It owns the re-entry guard, the `pending` flag and the mapped error. The guard is a **ref,
not `pending`**: state only lands on the next render, so a second tap in the same tick
sails past a state-only check. `run` resolves to the action's result, or `undefined` if it
was skipped or threw — so navigate on the result, never unconditionally.

Multi-step forms don't need it: `useStepForm` already returns `submitting` (react-hook-form's
`isSubmitting`, read during render so the Proxy subscribes) and guards re-entry itself.
Feed it to `FormLayout`'s `busy`.

Where several buttons share a screen, give each its own `useAsyncAction` and lock the rest
with a combined `busy` — then the button that is actually working is the one that spins.

## Keyboard avoidance

Two rules, both learned from the chat composer being buried under the keyboard:

- **Always pass an explicit `behavior`**, on Android too. Expo enables edge-to-edge, so
  the manifest's `adjustResize` no longer shrinks the window and a `KeyboardAvoidingView`
  with `behavior={undefined}` does nothing at all. `padding` for a pinned bottom bar
  (`DossierChatScreen`), `height` for a scrolling form (`FormLayout`).
- **Pass `keyboardVerticalOffset` on any screen below a Stack header** — and on Android
  add `insets.top` to it. The keyboard arrives in screen coordinates measured from the
  top of the display; the view's frame is laid out inside the screen. Two gaps have to
  be handed back: the header, and — on Android only — the status bar, because
  `measureInWindow` there reports `y` from *below* the status bar while the keyboard's
  `screenY` includes it. Measured on a Pixel: header 56 + status bar 53.3 = 109.3, and
  omitting either one leaves the composer under the keyboard. iOS measures from the top
  of the window, which is already the top of the screen, so it needs no correction.
  Measure the header with `measureInWindow` on a wrapper `View` in `onLayout` rather
  than hardcoding: there is no `useHeaderHeight` here (expo-router 56 ships no
  `@react-navigation/elements`) and the header is taller on notched devices.
  `DossierChatScreen` is the worked example.

A bottom bar that pads itself with `insets.bottom` must drop that inset while the
keyboard is open (`Keyboard.addListener("keyboardDidShow"/"keyboardDidHide")`) — the
keyboard already covers the home indicator, so keeping it leaves a dead band.

## Copy

All UI copy is French, matching the spec verbatim. Errors are specific and actionable
(`"Email ou mot de passe incorrect."`, not `"Erreur"`). Auth copy comes from
`mapAuthError`, data copy from `mapDataError` — a screen should render a mapped message,
never invent its own.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Hardcoding `#111` / `12` instead of a token | Drifts from the rest of the app; breaks a future token change |
| Building a label/value block out of `@expo/ui`, or by hand | `InfoCard` + its three parts is the only shape |
| An `InfoCard` nested inside a `Section` of the same name | The title is rendered twice |
| A part that draws its own divider | Doubled lines — the card owns the separators |
| Rendering `null`/`""` instead of `dash()` | "null" or blank rows in the UI |
| Re-implementing loading / empty / error state per screen | `Section` and `InfoCard` both already own all four states |
| A bare `ActivityIndicator` | `Spinner` / `ScreenLoader` own the token colour and padding |
| `return null` while a hook is loading | A blank screen is indistinguishable from a broken one — use `ScreenLoader` |
| A hand-rolled `busy` boolean, or a `useRef` guard with no re-render | `useAsyncAction` (or `useStepForm`'s `submitting`) gives you both the guard and the flag |
| Rendering a hook's `loading` but discarding its `error` | An offline or denied read then reads as "aucun dossier" |
| `Alert.alert` instead of `alertDialog` / `confirmDialog` | Silently does nothing on web |
| A long free-text value in an `InfoRows` row instead of an `InfoComment` | Squeezes the label; text overflows off-screen |
| Gating a `tel:` / `mailto:` button on `canOpenURL` | Android package visibility answers `false`; the button vanishes on device but shows on web |
| New modal without its own `GestureHandlerRootView` | Gestures silently dead inside the modal |
| `KeyboardAvoidingView` with no `behavior` on Android, or no `keyboardVerticalOffset` under a Stack header | Keyboard covers the input |
