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

**Never wrap a universal `@expo/ui` component that renders its own `Host` in another
`Host`.** `BottomSheet` has rendered its own since `@expo/ui` 56.0.10 — absolutely
positioned, so it costs no layout and needs no wrapper. The scaffold's leftover
`<Host style={{ position: "absolute", width: 0, height: 0 }}>` around it shipped as an
iOS bug: with no `snapPoints` the sheet auto-sizes to its content (`fitToContents` →
`presentationDetents([.height(measured)])`), and content measured inside a zero-sized
host collapses to a detent too short to show both buttons. Android was unaffected —
Compose's `ModalBottomSheet` sizes to intrinsic content — so this is only visible on a
device or iOS simulator. Check the installed `@expo/ui` source before adding a `Host`.

The info lists that used to live in `src/components/native/` were replaced by `InfoCard`
(see below) precisely because `@expo/ui`'s `Row` + `Spacer(flexible)` can't do dividers,
icon buttons, or a value that wraps instead of squeezing its label.

## Tokens are the only source of style

`src/theme/tokens.ts` holds colours, spacing, radius, button height, title/subtitle text
styles, and the per-status badge palette. Never hardcode a hex or spacing value a token
covers.

```ts
colors: primary #2A2933 · primaryText #fff · muted #71727A · border #E5E7EB
        divider #F3F4F6 · disabled #C1C1C6 (also placeholder) · surfaceAlt #FAFAFA
        surface #fff · danger #9F0712 · success #16A34A
brand:  brand #1FC61B · brandTint #E7F7E6 · brandPressed #17A814
status: a_traiter (amber) · en_cours (blue) · cloture (green)   // keyed by DossierStatus
radius: sm 8 · md 12 · lg 16        space: xs 4 · sm 8 · md 12 · lg 24 · xl 28
text:   title · subtitle · fieldLabel · fieldError
control: base · error · text        // the input/dropdown box chrome
```

`text.fieldLabel` / `text.fieldError` and the `control.*` group are what `FormField`,
`Dropdown` and `CheckboxGroup` render their label, error and box from. A new form control
spreads those tokens rather than restating the height/border/fill — that chrome was
triplicated once and drifted.

`primary` and the `brand*` colours come from the logo (`assets/images/icon.png`): a **BE**
monogram in `#1FC61B` on a `#2A2933` charcoal disc. `primary` is that charcoal, not a
neutral black.

**Where green is allowed.** `brand` is for _affordances and identity accents_ only — the
`InfoCard` header rule, the `InfoContactRow` phone/mail buttons, the `EntityCard` row
action, a selected `Dropdown` option, the `DossierCard` thumbnail placeholder. It is
**never** a large fill and **never** a state colour: primary `Button` stays charcoal, and
"this went well" stays `success`/`status`, which sit deliberately close to the brand green
and would otherwise blur into it.

`brand` is only ever a **background**, under a `primary` glyph or label (6.3:1). It is
~2.3:1 on white, so green _text_ or a green icon on a light surface needs a much darker
green than this — none is tokenised, because nothing needs one yet.

**Nothing sets the app background.** There is no `ThemeProvider`, so screens sit on
react-navigation's own `DefaultTheme` background (`#F2F2F2`). A screen should not paint its
own background either; white _inside_ a screen is `surface`.

`tokens.status` is keyed by `DossierStatus`, so adding a status means adding its palette
entry — `StatusBadge` reads it directly.

## Info cards

**Every read-only label/value block in the app is an `InfoCard`** — a dark title bar over
a white body split into parts by hairline dividers. Full contract in
`docs/specs/component-info-card.md`. Four part components:

| Part                  | For                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `InfoRows`            | `rows: [label, value][]` — the liste d'information                          |
| `InfoContactRow`      | `kind="phone" \| "email"` — value plus a right-aligned action button        |
| `InfoComment`         | Free text (commentaires, accessoires) full-width below its label            |
| `InfoCollapsibleRow`  | `{ label, value, rows?: InfoRow[] \| null }` — a label/value row that reveals more `InfoRows` behind a chevron button. `rows` is the switch: `null`/`undefined`/`[]` renders a plain row with no button, so "only when the answer is oui" lives at the call site |

Rules that must survive any restyle:

- **`InfoCard` replaces `Section`** for these blocks — its title bar _is_ the title. Never
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
- **`viewerStatus(status, role)`** — what that role is _allowed_ to see. `a_traiter` is
  the back office's working state, so a b2b viewer gets `en_cours` back (label **and**
  blue palette); the back office gets the real status. Project **once at the screen**
  and pass the result down — `StatusBadge` and the "Statut" row stay role-unaware, so
  they cannot disagree. `DossierDetailScreen` is the worked example.
- **Optional rows are omitted by the caller**, not rendered empty. There are no
  `showX` props on the parts.
- **`isOui(v)`**, **`ouiNon(bool)`**, **`hasMateriel(materiel, "batterie" | "chargeur")`** —
  the trio behind `InfoCollapsibleRow`'s gating. `isOui` is `true` only for the stored
  `"oui"`; the dossier's collapsible rows gate on it because the funnel leaves every
  sub-answer `null` unless the parent answer was "oui". `ouiNon` renders a _derived_
  boolean in the same vocabulary as a stored `OuiNon`. `hasMateriel` checks membership in
  `vehicle.materiel`, which stores the funnel's checkbox _labels_ — the helper owns that
  coupling so a screen never string-matches French copy inline.

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

Package visibility restricts _querying_, not `startActivity` — so `openURL` works
regardless. Render the affordance and handle the real failure in the promise rejection
(`alertDialog` with French copy). That rejection fires on Android and on a real iOS
device; react-native-web always resolves and the iOS simulator resolves `NO` for `tel:`,
so those two tap silently — acceptable, since both are dev/browser-only. The same
reasoning applies to any future `tel:`, `mailto:`, `sms:` or third-party-app deep link.

Use it for a contact you can **reach**. "Mon compte" shows the viewer's own number and
address as plain `InfoRows`.

## Shared components

| Component                                                            | Notes                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui/InfoCard` + `ui/InfoRows`, `ui/InfoContactRow`, `ui/InfoComment`, `ui/InfoCollapsibleRow` | Every read-only label/value block — see "Info cards" above                                                                                                                                                                                                                                                                             |
| `ui/Section`                                                         | Title + `loading` + `error` + `emptyMessage` + children, for **button groups and card lists**. Owns all four states in that precedence — don't reimplement them per screen                                                                                                                                                             |
| `ui/Spinner`                                                         | The **only** spinner. Never render a bare `ActivityIndicator`: this owns the token colour. `ScreenLoader` (named export) is the centred whole-screen/region variant                                                                                                                                                                    |
| `ui/ScreenMessage`                                                   | Screen-level counterpart to `Section`'s error/empty states: `message` + `tone` (`muted` \| `danger`)                                                                                                                                                                                                                                   |
| `ui/SectionWrapper`                                                  | Layout shell around sections                                                                                                                                                                                                                                                                                                           |
| `ui/DossiersSection`, `ui/CompaniesSection`                          | Per-section fetch + `Section`                                                                                                                                                                                                                                                                                                          |
| `ui/DossierCard`, `ui/CompanyCard`                                   | Thin wide cards; see their component specs                                                                                                                                                                                                                                                                                             |
| `ui/StatusBadge`                                                     | Reads `tokens.status` by `DossierStatus`, and its copy from `lib/ui/format`'s `STATUS_LABELS`                                                                                                                                                                                                                                          |
| `ui/Button`                                                          | The only button. Never hand-roll a `Pressable` with its own styling. `loading` swaps the label for a spinner and blocks presses; `disabled` only dims. `loading` wins — a spinning button is never also dimmed. The spoken label is the `label`; pass `accessibilityLabel` only when that reads badly aloud (a slash, an abbreviation) |
| `ui/ImageViewerModal`                                                | Full-screen modal precedent — wraps content in its own `GestureHandlerRootView`                                                                                                                                                                                                                                                        |
| `ui/ConfirmationView`                                                | Success screen with delayed auto-redirect                                                                                                                                                                                                                                                                                              |

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
  `measureInWindow` there reports `y` from _below_ the status bar while the keyboard's
  `screenY` includes it. Measured on a Pixel: header 56 + status bar 53.3 = 109.3, and
  omitting either one leaves the composer under the keyboard. iOS measures from the top
  of the window, which is already the top of the screen, so it needs no correction.
  Measure the header with `measureInWindow` on a wrapper `View` in `onLayout` rather
  than hardcoding: there is no `useHeaderHeight` here (expo-router 56 ships no
  `@react-navigation/elements`) and the header is taller on notched devices.
  `DossierChatScreen` is the worked example.

## A chat thread has to be scrolled, deliberately

A `ScrollView` opens at offset 0 and stays there. The thread is oldest-first, so
`ChatThread` shipped once showing the *oldest* messages with every new bubble landing
below the fold — which read as "the notification dropped me above the composer". The
rule is deliberately unconditional: **the view is always at the latest message.** Three
handlers own it, and all three are load-bearing:

- `onContentSizeChange` — first layout and every new message, incoming or the user's
  own. *Not* an image loading: the thumbnail is a fixed 160 × 160, so it grows nothing;
- `onLayout` — content unchanged, frame changed. The case it is there for is the keyboard
  opening under `KeyboardAvoidingView`, which would otherwise slide the last bubble behind
  the composer — but it is left unnarrowed, so dismissing the keyboard and rotating re-pin
  as well;
- `useFocusEffect` — every *return* to the tab. Neither of the other two fires then: the
  tab screens stay mounted, so the view would otherwise still be wherever the user
  scrolled to last time. It is a focus transition, so re-tapping an already-focused
  "Messages" does nothing.

Nothing tracks whether the user had scrolled up — an earlier version gated all of this
on an `isNearBottom` helper so history-reading was never interrupted, and it was dropped
on purpose. The first scroll does not animate — flying past the history is a glitch, not
an arrival — and neither does a re-focus, for the same reason.

A bottom bar that pads itself with `insets.bottom` must drop that inset while the
keyboard is open (`Keyboard.addListener("keyboardDidShow"/"keyboardDidHide")`) — the
keyboard already covers the home indicator, so keeping it leaves a dead band.

## Copy

All UI copy is French, matching the spec verbatim. Errors are specific and actionable
(`"Email ou mot de passe incorrect."`, not `"Erreur"`). Auth copy comes from
`mapAuthError`, data copy from `mapDataError` — a screen should render a mapped message,
never invent its own.

## Common mistakes

| Mistake                                                                                                   | Consequence                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Hardcoding `#2A2933` / `12` instead of a token                                                            | Drifts from the rest of the app; breaks a future token change                              |
| `brand` as a text or icon colour on a light surface                                                       | ~2.3:1 — fails AA. It is a background only                                                 |
| Green on a primary `Button`, or as a success/state colour                                                 | Spends the accent everywhere and collides with `success` / `status.cloture`                |
| Building a label/value block out of `@expo/ui`, or by hand                                                | `InfoCard` + its three parts is the only shape                                             |
| An `InfoCard` nested inside a `Section` of the same name                                                  | The title is rendered twice                                                                |
| A part that draws its own divider                                                                         | Doubled lines — the card owns the separators                                               |
| Rendering `null`/`""` instead of `dash()`                                                                 | "null" or blank rows in the UI                                                             |
| Re-implementing loading / empty / error state per screen                                                  | `Section` and `InfoCard` both already own all four states                                  |
| A bare `ActivityIndicator`                                                                                | `Spinner` / `ScreenLoader` own the token colour and padding                                |
| `return null` while a hook is loading                                                                     | A blank screen is indistinguishable from a broken one — use `ScreenLoader`                 |
| A hand-rolled `busy` boolean, or a `useRef` guard with no re-render                                       | `useAsyncAction` (or `useStepForm`'s `submitting`) gives you both the guard and the flag   |
| Rendering a hook's `loading` but discarding its `error`                                                   | An offline or denied read then reads as "aucun dossier"                                    |
| `Alert.alert` instead of `alertDialog` / `confirmDialog`                                                  | Silently does nothing on web                                                               |
| A long free-text value in an `InfoRows` row instead of an `InfoComment`                                   | Squeezes the label; text overflows off-screen                                              |
| Gating a `tel:` / `mailto:` button on `canOpenURL`                                                        | Android package visibility answers `false`; the button vanishes on device but shows on web |
| New modal without its own `GestureHandlerRootView`                                                        | Gestures silently dead inside the modal                                                    |
| A `Host` wrapped around a universal `@expo/ui` component that already renders one                         | On iOS the 0×0 host collapses the measured content — the auto-sized `BottomSheet` came out too short to show its buttons |
| `KeyboardAvoidingView` with no `behavior` on Android, or no `keyboardVerticalOffset` under a Stack header | Keyboard covers the input                                                                  |
