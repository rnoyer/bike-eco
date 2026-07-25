# Interactive attachments — chat image/PDF viewing + tappable dossier carousel

**Date:** 2026-07-22
**Status:** Implemented — revised 2026-07-25

> **Revision (2026-07-25, after on-device testing).** The full-screen viewer was
> **descoped from a swipeable gallery to a single-image viewer**. On device, zoom
> worked but paging between images did not, and the owner chose to drop paging
> rather than debug it: tapping a photo now opens *that* photo full-screen with
> zoom and a close button, and nothing else. Removed as dead code: the paging
> `ScrollView` and page dots, the `scale`→`scrollEnabled` bridge
> (`ZoomableImage`'s `onZoomChange`), `clampIndex`, and `threadImageUrls` (plus
> both helpers' unit tests). `ImageGalleryModal` became `ImageViewerModal({ uri,
> onClose })`. Sections below are updated to match; the gesture-coordination
> discussion is kept for the record but **no longer describes the build**.

## Problem

Chat attachments render as a static emoji + filename (`ChatThread`'s `Attachment`):
they convey *that* a file exists but can't be opened. The dossier `PhotoCarousel`
shows photos inline but can't be enlarged. Users want to actually view what was
shared.

## Goals

- Chat **image** attachments render as a real, tappable thumbnail that opens that
  photo full-screen with **pinch-to-zoom** and double-tap-zoom, dismissed via a
  close button. ~~swipeable gallery spanning every photo in the thread~~ (dropped
  2026-07-25 — see the revision note).
- Chat **PDF** attachments render as a prominent, tappable icon (the
  `pdfIcon.svg` asset) plus the filename, ellipsized when too long, that opens
  the device's default PDF handler.
- The dossier **`PhotoCarousel`** photos become tappable and open the *same*
  full-screen single-image viewer.

## Non-goals (YAGNI)

- In-app PDF rendering / download-to-device (the owner chose the system default
  handler via `Linking.openURL`).
- Any change to how attachments are picked, uploaded, or stored — that data layer
  is unchanged. This is a rendering/viewing feature only.

## Decisions (owner-confirmed)

1. **Images → one reusable in-app full-screen viewer**, shared by chat attachments
   and the dossier carousel. (Originally a *swipeable gallery*; descoped to a
   single-image viewer on 2026-07-25 — see the revision note.)
2. **PDFs → `Linking.openURL(url)`** — the OS opens its default handler (a PDF app
   if set, otherwise the browser, which renders the PDF). The user leaves the app.
3. **Images → pinch-to-zoom**, chosen over a static viewer. This makes the
   swipe/pinch gesture coordination the hard part.
4. **Image viewer → hand-rolled with `react-native-gesture-handler` +
   `react-native-reanimated`** (both already installed), *not* a third-party
   gallery library. Reanimated 4 + Gesture Handler 2 run gestures on the UI
   thread, so a lightweight custom viewer avoids third-party lock-in and the
   reanimated-4 peer mismatch a gallery library would bring
   (`react-native-awesome-gallery@0.4.3` peers `react-native-reanimated ^3.2.0`;
   this project is on 4.3.1). **Zero new dependencies.** `expo-linking` (PDFs) and
   `expo-image` (thumbnails) are already installed.

## Hard part & first step (de-risk before the call sites) — SUPERSEDED 2026-07-25

> This section described coordinating swipe-paging against pan-while-zoomed. Paging
> was dropped, so none of it is in the build: there is one image on screen, pan is
> always "within the image", and no `scale`→paging bridge exists. Two findings from
> this work do still matter, and are recorded below the fold:
> **(a)** a React Native `Modal` renders into a separate native view hierarchy, so
> its content needs its **own** `GestureHandlerRootView` or no gesture-handler
> gesture inside it is ever recognized — this was the actual cause of "zoom doesn't
> work at all"; **(b)** the animated transform must sit on a wrapping
> `Animated.View`, since `expo-image` is not an Animated component.

### Original (historical) analysis

The one genuinely tricky piece is coordinating two gestures: horizontal
**swipe-between-images** (paging) vs. **pan-while-zoomed** (moving inside a zoomed
image). The rule: paging is live only while the current image sits at scale 1;
once pinched in (`scale > 1`) paging is suppressed and pan moves within the image;
zooming back to 1 re-enables paging. Bridging the UI-thread `scale` to the
JS-thread paging toggle is done with `useAnimatedReaction` + `runOnJS`.

The plan's **first task builds and de-risks exactly this**: wrap the app root in
`GestureHandlerRootView` (nothing uses gesture-handler yet), build the per-image
`ZoomableImage` and the paging container, and verify on-device that (a) swiping
pages between images at rest, (b) pinch / double-tap zoom and pan work when zoomed,
and (c) paging is suppressed while zoomed. Everything else (thumbnails, call sites,
PDFs) is straightforward once this holds.

## Components

### `ZoomableImage` (new — `src/components/ui/ZoomableImage.tsx`)

One full-screen page: a single `expo-image` with pinch-, double-tap-, and
pan-when-zoomed gestures. Built directly on `react-native-gesture-handler` +
`react-native-reanimated` shared values (`scale`/`translateX`/`translateY` + their
saved counterparts), composing `Gesture.Race(doubleTap, Gesture.Simultaneous(pinch,
pan))`. Pan only moves the image while `scale > 1`; zooming fully out resets the
translation. Refinements over the bare version: clamp `scale` to a max and clamp
pan so the image can't be flung entirely off-screen.

- **Props:** `uri: string`. (The `onZoomChange` callback existed only to suppress
  gallery paging; removed 2026-07-25 with paging itself.)

### `ImageViewerModal` (new — `src/components/ui/ImageViewerModal.tsx`)

A single-responsibility full-screen viewer. It does not know about chat or
dossiers — it shows **one** image URL.

- **Props:** `{ uri, onClose }`
  - `uri: string` — the image to show.
  - `onClose: () => void`
  - No `visible` prop: the parent mounts the modal only while open and unmounts it
    via `onClose`, so the component holds no state at all.
- **Behavior:** a full-screen dark `Modal` containing one `ZoomableImage` and a
  close “✕”. Its content is wrapped in its **own** `GestureHandlerRootView` — a
  React Native `Modal` renders into a separate native view hierarchy that the
  app-root one does not cover, and without this no gesture inside is recognized.
  An image that fails to load shows `expo-image`'s placeholder rather than crashing.
- **Interface contract:** both call sites drive it purely through props; it owns no
  attachment/dossier knowledge.

There is no non-UI logic left in the viewer, so it has no unit tests.

### `ChatThread` — `Attachment` (modified — `src/components/ui/chat/ChatThread.tsx`)

- **Image attachment:** a `Pressable` wrapping an `expo-image` thumbnail (small
  rounded square). Tapping opens **that** photo full-screen.
- **PDF attachment:** a `Pressable` with the `pdfIcon.svg` asset + filename
  (`numberOfLines={1}` + `ellipsizeMode="tail"`) → `Linking.openURL(a.url)`; on
  failure, a French `Alert` ("Impossible d'ouvrir le PDF."). The SVG is rendered
  by `expo-image` from a `require()` — Expo's Metro config already lists `svg` in
  `assetExts`, so this needs no `react-native-svg` and matches how
  `HeaderBackButton` / `ThirdPartyAuthButtons` already load their icons.
- **Own-message contrast:** a sender's own bubble is `tokens.colors.primary`
  (`#111`), so the PDF row takes a `mine` variant (translucent-white fill,
  `primaryText` filename). Without it the filename is `#111` on `#111` — invisible.
- `ChatThread` owns a single `viewerUri: string | null`; a tap in any bubble sets
  it and drives the one `ImageViewerModal` rendered at the thread level.

### `PhotoCarousel` (modified — `src/components/ui/PhotoCarousel.tsx`)

- Wrap each inline photo in a `Pressable`. Tapping opens `ImageViewerModal` on
  that photo. The inline carousel is otherwise unchanged and remains the place you
  swipe between the dossier's photos; tapping promotes one to full-screen. Its dots
  overlay is `pointerEvents="none"` so it never swallows a tap meant for the photo.

## Data flow

Attachment/photo URLs already exist (`MessageAttachment.url`, `Dossier.photos`).
No fetching changes. Tapping selects a URL list + index and toggles the modal;
the modal renders from those props. PDF taps call `Linking.openURL` directly.

## Error handling

- **PDF open fails** (`Linking.openURL` rejects — no handler): caught, French
  `Alert`. No crash.
- **Image fails to load:** `expo-image` placeholder; the gallery stays usable.
- **No attachments / text-only message:** unchanged.

## Testing

This is entirely `Modal` / gesture / native-open UI — not meaningfully
unit-testable, consistent with `PhotoCarousel` and the pickers today. **There is no
pure logic left to test:** both helpers that had unit tests (`clampIndex`,
`threadImageUrls`) existed only to support paging and were deleted with it.

Everything is verified in the interactive walkthrough (open a chat image →
full-screen + zoom + ✕; open a PDF → system reader; tap a dossier carousel photo →
full-screen + zoom + ✕). No mock-only tests that assert nothing.

## Spec sync

Updated in the same change:
- `docs/specs/page-chat.md` — attachments are interactive: an image thumbnail opens
  that photo full-screen with zoom; PDFs show the icon + ellipsized name and open in
  the system reader.
- `docs/specs/page-dossier.md` — carousel photos open full-screen with zoom on tap.
