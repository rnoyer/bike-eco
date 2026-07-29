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

Two rendering layers, one token set. Read the matching `docs/specs/page-*.md` or
`component-*.md` before building — they are the source of truth for layout and French
copy. Gate with `docs/tech/verification.md`.

## The two layers

| Layer | Where | Built from | Use for |
|---|---|---|---|
| **Native** | `src/components/native/` | `@expo/ui`: `Host`, `Column`, `Row`, `Text`, `Spacer` | Read-only info lists rendered inside a screen |
| **RN** | `src/components/ui/`, `src/components/form/` | React Native + `@/theme/tokens` | Everything else: forms, cards, buttons, modals, sections |

Forms are **always** the RN layer — see `bike-eco-forms`. Don't convert an existing
component from one layer to the other as a side effect of another change.

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

The one documented exception: `src/components/native/*InfoList.tsx` declare local `LABEL`
/ `VALUE` text constants because `@expo/ui` `textStyle` takes plain objects, not RN
styles. Their values still mirror the tokens (`#71727A`, `#111`).

## Info lists

`AccountInfoList`, `CompanyInfoList`, `DossierInfoList`, `UserInfoList` all follow one
shape: build a `rows: [string, string][]` array, then map it to `Row` +
`Text(label) · Spacer(flexible) · Text(value)`.

Conventions that must survive any restyle:

- **`dash()`** renders `"—"` for `null` / `undefined` / `""`. Never print "null" or an
  empty row.
- **Units live in the value**: `${cylindree} cc`, `${kilometrage} km`, `${prix} €` — and
  the field is dashed when absent, not rendered as a bare unit.
- **Optional rows are conditional**, via props (`CompanyInfoList`'s `showName`,
  `showRegion`) — not by rendering an empty row.

### The Android crash

Use a non-scrolling `Column`, **never** a native `List`. The screen's RN `ScrollView`
owns scrolling; a native scroller measured with unbounded height crashes on Android. This
is already commented in `DossierInfoList.tsx` — keep the comment if you rewrite the file.

### Long values

A long `commentaires` value in a `Row` fights the label for width, because `Row` +
`Spacer(flexible)` is a single-line layout. Free-text fields need their own full-width
block below the label rather than a right-aligned value in the same row, plus a character
cap on the input side (`bike-eco-forms`).

### Tappable phone / email

`Linking.openURL` with `tel:` and `mailto:` opens the OS dialer and mail client. Guard
with `canOpenURL` and fall back to plain text — a simulator or a tablet without a dialer
returns false. Strip spaces from the phone number for the `tel:` href while leaving the
displayed value formatted.

## Shared components

| Component | Notes |
|---|---|
| `ui/Section` | Title + `loading` + `error` + `emptyMessage` + children. Owns all four states in that precedence — don't reimplement them per screen |
| `ui/Spinner` | The **only** spinner. Never render a bare `ActivityIndicator`: this owns the token colour. `ScreenLoader` (named export) is the centred whole-screen/region variant |
| `ui/ScreenMessage` | Screen-level counterpart to `Section`'s error/empty states: `message` + `tone` (`muted` \| `danger`) |
| `ui/SectionWrapper` | Layout shell around sections |
| `ui/DossiersSection`, `ui/CompaniesSection` | Per-section fetch + `Section` |
| `ui/DossierCard`, `ui/CompanyCard` | Thin wide cards; see their component specs |
| `ui/StatusBadge` | Reads `tokens.status` by `DossierStatus` |
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
| Native `List` inside `components/native/` | Android crash on unbounded-height measurement |
| Rendering `null`/`""` instead of `dash()` | "null" or blank rows in the UI |
| Re-implementing loading / empty / error state per screen | `Section` already owns all four states |
| A bare `ActivityIndicator` | `Spinner` / `ScreenLoader` own the token colour and padding |
| `return null` while a hook is loading | A blank screen is indistinguishable from a broken one — use `ScreenLoader` |
| A hand-rolled `busy` boolean, or a `useRef` guard with no re-render | `useAsyncAction` (or `useStepForm`'s `submitting`) gives you both the guard and the flag |
| Rendering a hook's `loading` but discarding its `error` | An offline or denied read then reads as "aucun dossier" |
| `Alert.alert` instead of `alertDialog` / `confirmDialog` | Silently does nothing on web |
| A long free-text value in a label/value `Row` | Squeezes the label; text overflows off-screen |
| `Linking.openURL` without `canOpenURL` | Dead tap on devices with no dialer/mail client |
| New modal without its own `GestureHandlerRootView` | Gestures silently dead inside the modal |
| `KeyboardAvoidingView` with no `behavior` on Android, or no `keyboardVerticalOffset` under a Stack header | Keyboard covers the input |
