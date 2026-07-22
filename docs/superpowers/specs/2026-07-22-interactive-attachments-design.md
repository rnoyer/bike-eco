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
  **pinch-to-zoom** (and the double-tap-zoom / swipe-to-close that come with it).
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
4. **Image viewer → a gallery library** (`react-native-awesome-gallery`) built on
   the already-installed `react-native-gesture-handler` + `react-native-reanimated`,
   giving swipe + pinch + double-tap-zoom + swipe-to-close out of the box — subject
   to the compatibility spike below. `expo-linking` (PDFs) and `expo-image`
   (thumbnails) are already installed.

## Dependency risk & first step (must be resolved before building the rest)

`react-native-awesome-gallery@0.4.3` (latest) declares a peer of
`react-native-reanimated: ^3.2.0`; this project is on **reanimated 4.3.1** (a
major version with breaking changes). It is therefore **not verified compatible**,
and there is no newer release targeting v4.

The plan's **first task is a compatibility spike**: install it (`--legacy-peer-deps`),
wrap the app root in `GestureHandlerRootView`, render a minimal gallery, and
confirm swipe + pinch + swipe-to-close work on-device against reanimated 4. Also
gate on `expo-doctor` / a dev-client build succeeding.

- **If it works:** proceed with the library.
- **If it does not:** fall back to a hand-rolled viewer using the installed
  gesture-handler + reanimated directly (per-image pinch + pan on a paging
  container; horizontal paging disabled while zoomed). Same `ImageGalleryModal`
  public interface either way, so the call sites (chat, carousel) are unaffected
  by which path wins.

## Components

### `ImageGalleryModal` (new — `src/components/ui/ImageGalleryModal.tsx`)

A single-responsibility full-screen viewer. It does not know about chat or
dossiers — it shows a list of image URLs, swipeable, starting at an index.

- **Props (stable across both the library and fallback implementations):**
  - `images: string[]` — image URLs to show.
  - `initialIndex: number` — which one to open on (clamped into `[0, images.length)`).
  - `visible: boolean`
  - `onClose: () => void`
- **Behavior:** a full-screen presentation (Modal / full-screen overlay) wrapping
  the gallery library's component, opened at `initialIndex`, with swipe between
  images, pinch- and double-tap-zoom, and swipe-to-close (calling `onClose`); a
  visible close “✕” as well. An image that fails to load shows a placeholder
  rather than crashing.
- **Interface contract:** both call sites drive it purely through props; it owns
  no attachment/dossier knowledge. This interface is identical whether the library
  or the hand-rolled fallback backs it, so the spike's outcome never touches the
  call sites.

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
