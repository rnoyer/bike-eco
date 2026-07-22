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
  full-screen, swipeable image gallery.
- Chat **PDF** attachments render as a prominent, tappable icon that opens the
  device's default PDF handler.
- The dossier **`PhotoCarousel`** photos become tappable and open the *same*
  full-screen swipeable gallery.

## Non-goals (YAGNI)

- Pinch-to-zoom in the viewer (can be added later; needs gesture-handler wiring).
- Swipe-down-to-dismiss gesture (a close button + tap-background-to-close suffice).
- In-app PDF rendering / download-to-device (the owner chose the system default
  handler via `Linking.openURL`).
- Any change to how attachments are picked, uploaded, or stored — that data layer
  is unchanged. This is a rendering/viewing feature only.

## Decisions (owner-confirmed)

1. **Images → one reusable in-app full-screen swipeable gallery**, shared by chat
   attachments and the dossier carousel.
2. **PDFs → `Linking.openURL(url)`** — the OS opens its default handler (a PDF app
   if set, otherwise the browser, which renders the PDF). The user leaves the app.
3. **Implementation:** a custom full-screen `Modal` + horizontal paging
   `ScrollView` (the pattern `PhotoCarousel` already uses), rendered with
   `expo-image`. No new dependencies (`expo-image` and `expo-linking` are already
   installed).

## Components

### `ImageGalleryModal` (new — `src/components/ui/ImageGalleryModal.tsx`)

A single-responsibility full-screen viewer. It does not know about chat or
dossiers — it shows a list of image URLs, swipeable, starting at an index.

- **Props:**
  - `images: string[]` — image URLs to show.
  - `initialIndex: number` — which one to open on (clamped into `[0, images.length)`).
  - `visible: boolean`
  - `onClose: () => void`
- **Behavior:** full-screen dark `Modal`; a horizontal `pagingEnabled`
  `ScrollView` scrolled to `initialIndex` on open; one `expo-image`
  (`contentFit="contain"`) per page; page dots when `images.length > 1`; a close
  “✕” affordance and tap-background-to-close. Horizontal swipe moves between
  images. An image that fails to load shows `expo-image`'s placeholder rather than
  crashing.
- **Interface contract:** both call sites drive it purely through props; it owns
  no attachment/dossier knowledge.

The only non-UI logic is clamping `initialIndex` into range — extracted as a tiny
pure helper and unit-tested.

### `ChatThread` — `Attachment` (modified — `src/components/ui/chat/ChatThread.tsx`)

- **Image attachment:** a `Pressable` wrapping an `expo-image` thumbnail (small
  rounded square). Tapping opens the gallery with **that message's image
  attachments** (PDFs in the same message are excluded), starting at the tapped
  image's position among them.
- **PDF attachment:** a `Pressable` with a larger PDF icon + filename →
  `Linking.openURL(a.url)`; on failure, a French `Alert` ("Impossible d'ouvrir le
  PDF.").
- `ChatThread` owns the gallery state (`images`, `initialIndex`, `visible`) so a
  tap in any bubble drives the one shared `ImageGalleryModal` instance rendered
  once at the thread level.

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
unit-testable, consistent with `PhotoCarousel` and the pickers today. The one pure
helper (clamping `initialIndex`) gets a unit test. Everything else is verified in
the interactive walkthrough (open a chat image → full-screen + swipe; open a PDF →
system reader; tap a dossier carousel photo → full-screen + swipe). No mock-only
tests that assert nothing.

## Spec sync

Updated in the same change:
- `docs/specs/page-chat.md` — attachments are interactive: image thumbnails open a
  full-screen swipeable gallery; PDFs open in the system reader.
- `docs/specs/page-dossier.md` — carousel photos open full-screen/swipeable on tap.
