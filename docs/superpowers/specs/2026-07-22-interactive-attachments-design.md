# Interactive attachments — chat image/PDF viewing + tappable dossier carousel

**Date:** 2026-07-22
**Status:** Approved (brainstorm)

## Problem

Chat attachments render as a static emoji + filename (`ChatThread`'s `Attachment`):
they convey *that* a file exists but can't be opened. The dossier `PhotoCarousel`
shows photos inline but can't be enlarged. Users want to actually view what was
shared.

## Goals

- Chat **image** attachments render as a real, tappable thumbnail that opens a
  full-screen, swipeable image gallery spanning every photo in the thread, with
  **pinch-to-zoom** and double-tap-zoom (dismissed via a close button / tap).
- Chat **PDF** attachments render as a prominent, tappable icon that opens the
  device's default PDF handler.
- The dossier **`PhotoCarousel`** photos become tappable and open the *same*
  full-screen swipeable gallery.

## Non-goals (YAGNI)

- In-app PDF rendering / download-to-device (the owner chose the system default
  handler via `Linking.openURL`).
- Any change to how attachments are picked, uploaded, or stored — that data layer
  is unchanged. This is a rendering/viewing feature only.

## Decisions (owner-confirmed)

1. **Images → one reusable in-app full-screen swipeable gallery**, shared by chat
   attachments and the dossier carousel.
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

## Hard part & first step (de-risk before the call sites)

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

- **Props:** `uri: string`; `onZoomChange?: (zoomed: boolean) => void` — reports
  (via `runOnJS`) whether this page is currently zoomed, so the gallery can
  suppress paging.

### `ImageGalleryModal` (new — `src/components/ui/ImageGalleryModal.tsx`)

A single-responsibility full-screen viewer. It does not know about chat or
dossiers — it shows a list of image URLs, swipeable, starting at an index.

- **Props:** `{ images, initialIndex, onClose }`
  - `images: string[]` — image URLs to show.
  - `initialIndex: number` — which one to open on (clamped into `[0, images.length)`).
  - `onClose: () => void`
  - No `visible` prop: the parent mounts the modal only while open and unmounts it
    via `onClose`. That keeps the initial page a one-shot read of props (no effect,
    so no sync `setState`-in-effect, which `expo lint`'s React Compiler rejects) and
    makes reopening at a different index correct by construction.
- **Behavior:** a full-screen dark `Modal` containing a horizontal `pagingEnabled`
  container of `ZoomableImage` pages, scrolled to `initialIndex` on open; page dots
  when `images.length > 1`; a close “✕”. Horizontal swipe pages between images; the
  container's paging is disabled while the current page reports itself zoomed (so
  pan works within the image), and re-enabled on zoom-out. An image that fails to
  load shows `expo-image`'s placeholder rather than crashing.
- **Interface contract:** both call sites drive it purely through props; it owns no
  attachment/dossier knowledge.

The only non-UI logic is clamping `initialIndex` into range — extracted as a tiny
pure helper and unit-tested.

### `ChatThread` — `Attachment` (modified — `src/components/ui/chat/ChatThread.tsx`)

- **Image attachment:** a `Pressable` wrapping an `expo-image` thumbnail (small
  rounded square). Tapping opens the gallery over **every image attachment in the
  whole thread** — all messages' image URLs flattened in thread order, PDFs
  excluded — starting at the tapped image's position in that flattened list. So
  the viewer lets you swipe through the entire conversation's photos, not just one
  message's.
- **PDF attachment:** a `Pressable` with a larger PDF icon + filename →
  `Linking.openURL(a.url)`; on failure, a French `Alert` ("Impossible d'ouvrir le
  PDF.").
- `ChatThread` owns the gallery state (`images`, `initialIndex`, `visible`) so a
  tap in any bubble drives the one shared `ImageGalleryModal` instance rendered
  once at the thread level. The flattened thread-image list is derived from
  `messages` (a pure helper — see Testing).

### `PhotoCarousel` (modified — `src/components/ui/PhotoCarousel.tsx`)

- Wrap each inline photo in a `Pressable`. Tapping opens `ImageGalleryModal` with
  **all** of the dossier's `photos`, starting at the tapped index. The inline
  carousel is otherwise unchanged; tapping promotes it to full-screen.

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

This is almost entirely `Modal` / `ScrollView` / native-open UI — not meaningfully
unit-testable, consistent with `PhotoCarousel` and the pickers today. The pure
logic gets unit tests:
- clamping `initialIndex` into `[0, images.length)` in `ImageGalleryModal`;
- flattening a thread's messages into an ordered list of image-attachment URLs
  and locating a tapped attachment's index within it (drives the whole-thread
  gallery scope).

Everything else is verified in the interactive walkthrough (open a chat image →
full-screen + swipe across the thread's photos; open a PDF → system reader; tap a
dossier carousel photo → full-screen + swipe). No mock-only tests that assert
nothing.

## Spec sync

Updated in the same change:
- `docs/specs/page-chat.md` — attachments are interactive: image thumbnails open a
  full-screen swipeable gallery; PDFs open in the system reader.
- `docs/specs/page-dossier.md` — carousel photos open full-screen/swipeable on tap.
