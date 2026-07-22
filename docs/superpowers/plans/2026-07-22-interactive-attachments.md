# Interactive Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chat attachments and dossier photos interactive — image thumbnails open a full-screen, swipeable, pinch-to-zoom gallery; PDFs open in the device's default reader.

**Architecture:** A hand-rolled `ZoomableImage` (react-native-gesture-handler + react-native-reanimated) is paged inside an `ImageGalleryModal`. `ChatThread` and `PhotoCarousel` each own a small piece of state and render that one shared viewer. No third-party gallery library.

**Tech Stack:** Expo SDK 56, React Native 0.85, react-native-gesture-handler ~2.31, react-native-reanimated 4.3.1 (+ react-native-worklets 0.8.3), expo-image, expo-linking. All already installed.

**Spec:** `docs/superpowers/specs/2026-07-22-interactive-attachments-design.md`

## Global Constraints

- **Zero new dependencies.** gesture-handler, reanimated, worklets, expo-image, expo-linking are all already in `package.json`. Do NOT `expo install` / `npm add` anything.
- **No `babel.config.js` needed.** Per the Expo SDK 56 reanimated docs, `babel-preset-expo` auto-configures the worklets Babel plugin. Do not create a babel config.
- `react-native-gesture-handler` requires the app root wrapped in `GestureHandlerRootView` (Task 1) — nothing uses it yet.
- French UI copy for any user-facing text (e.g. the PDF-open error). UI copy matches the specs.
- Reuse `@/theme/tokens` for chrome (bubbles, chips) as the surrounding code does. A full-screen media viewer may use a black backdrop and translucent-white overlay literals — `PhotoCarousel` already uses `rgba(...)` literals for exactly this; match that.
- **`expo lint` (React Compiler) rejects SYNC `setState` in an effect body.** Do not put `setSomething(x)` directly in a `useEffect`. (The viewer avoids effects entirely — see Task 2.)
- Gate every task: `npx tsc --noEmit` + `npm run lint` + relevant `npx jest`.
- Test files import jest globals from `@jest/globals`. Pure-logic modules must not import from `firebaseConfig`/`@/lib/firestore/collections` or any React Native runtime component, so they load under the `jest-expo` preset (`import type` is erased and safe).
- These are UI/gesture components; only the two pure helpers (`clampIndex`, `threadImageUrls`) are unit-tested. Everything else is verified on-device — do NOT write mock-only tests that assert nothing.

---

## Task 1: Gesture root + `ZoomableImage`

**Files:**
- Modify: `src/app/_layout.tsx`
- Create: `src/components/ui/ZoomableImage.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ZoomableImage` (default-exported-as-named): `function ZoomableImage(props: { uri: string; onZoomChange?: (zoomed: boolean) => void }): JSX.Element`. Calls `onZoomChange(true)` when its image is zoomed past scale 1 and `onZoomChange(false)` when it returns to 1.

- [ ] **Step 1: Wrap the app root in `GestureHandlerRootView`**

Edit `src/app/_layout.tsx`. Add the import and wrap the existing tree (it must be the outermost element and needs `flex: 1`):

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";
```

Change the `RootLayout` return from:

```tsx
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate>
          {/* Groups own their headers; the root must not draw one per group screen
              (that produced the stacked "(b2b)" / "(tabs)" headers). */}
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
```

to:

```tsx
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate>
            {/* Groups own their headers; the root must not draw one per group screen
                (that produced the stacked "(b2b)" / "(tabs)" headers). */}
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
```

- [ ] **Step 2: Create `ZoomableImage.tsx`**

Create `src/components/ui/ZoomableImage.tsx`:

```tsx
import { Image } from "expo-image";
import { Dimensions, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const MAX_SCALE = 4;

/**
 * One full-screen page: an image with pinch-, double-tap-, and pan-when-zoomed
 * gestures. Pan is bounded so the image can't be flung off-screen, and the scale
 * is capped. `onZoomChange` reports (once per crossing of scale 1) whether this
 * page is zoomed, so the gallery can suspend its horizontal paging.
 *
 * The animated transform is applied to an `Animated.View` wrapping a plain
 * `expo-image` — expo-image is not an Animated component, so the style must sit on
 * the wrapper, not the image.
 */
export function ZoomableImage({
  uri,
  onZoomChange,
}: {
  uri: string;
  onZoomChange?: (zoomed: boolean) => void;
}) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  useAnimatedReaction(
    () => scale.value > 1,
    (zoomed, previous) => {
      if (onZoomChange && zoomed !== previous) runOnJS(onZoomChange)(zoomed);
    },
  );

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value === 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        const maxX = ((scale.value - 1) * SCREEN_W) / 2;
        const maxY = ((scale.value - 1) * SCREEN_H) / 2;
        translateX.value = Math.min(
          maxX,
          Math.max(-maxX, savedTranslateX.value + e.translationX),
        );
        translateY.value = Math.min(
          maxY,
          Math.max(-maxY, savedTranslateY.value + e.translationY),
        );
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.container}>
        <Animated.View style={[styles.imageWrap, animatedStyle]}>
          <Image source={{ uri }} style={styles.image} contentFit="contain" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
    justifyContent: "center",
  },
  imageWrap: { flex: 1, width: "100%" },
  image: { flex: 1, width: "100%", height: "100%" },
});
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (No unit test: this is gesture/worklet UI. `useAnimatedReaction` + `runOnJS` is not sync `setState`-in-effect, so the React Compiler lint is satisfied.)

- [ ] **Step 4: Verify on-device**

This is the de-risking gate for the whole feature (gesture coordination + reanimated worklets). Temporarily render a `ZoomableImage` on any visible screen with a real image URL (or verify it via Task 2's `ImageGalleryModal` once built — but confirm the worklets run *here* first). Start the dev client (`EXPO_PUBLIC_USE_EMULATORS=1 npx expo start`), then:
- Pinch → the image scales up (capped ~4×) and back to 1.
- Double-tap → toggles between 1× and 2.5×.
- While zoomed, drag → the image pans but cannot be dragged fully off-screen; at 1× dragging does nothing.

Expected: all three work smoothly. **If you see a runtime error mentioning "worklet" / "Reanimated"**, the worklets plugin isn't active — but per the Global Constraints it ships with `babel-preset-expo`, so first `rm -rf node_modules/.cache && npx expo start --clear` (stale transform cache) before investigating further. Remove any temporary render before committing.

- [ ] **Step 5: Commit**

```bash
git add src/app/_layout.tsx src/components/ui/ZoomableImage.tsx
git commit -m "feat(ui): zoomable image with pinch/pan/double-tap gestures"
```

---

## Task 2: `clampIndex` + `ImageGalleryModal`

**Files:**
- Create: `src/components/ui/imageGallery.ts`
- Test: `src/components/ui/imageGallery.test.ts`
- Create: `src/components/ui/ImageGalleryModal.tsx`

**Interfaces:**
- Consumes: `ZoomableImage` from Task 1.
- Produces:
  - `clampIndex(index: number, length: number): number` — floors and clamps into `[0, length)`; returns `0` when `length <= 0`.
  - `ImageGalleryModal` (default export): `function ImageGalleryModal(props: { images: string[]; initialIndex: number; onClose: () => void }): JSX.Element`. Rendered **only while open** by its parent (mounted on open, unmounted by `onClose`) — so it needs no `visible` prop and no effect to re-scroll on reopen.

> **Spec sync:** the spec listed a `visible` prop; the implementation drops it in favor of parent-controlled mounting (cleaner, and avoids sync `setState` in an effect). Update the spec's `ImageGalleryModal` props line to `{ images, initialIndex, onClose }` as part of this task (Step 6).

- [ ] **Step 1: Write the failing `clampIndex` test**

Create `src/components/ui/imageGallery.test.ts`:

```ts
import { expect, test } from "@jest/globals";
import { clampIndex } from "./imageGallery";

test("keeps an in-range index", () => {
  expect(clampIndex(1, 3)).toBe(1);
});

test("clamps below 0 and at/above length", () => {
  expect(clampIndex(-2, 3)).toBe(0);
  expect(clampIndex(3, 3)).toBe(2);
  expect(clampIndex(9, 3)).toBe(2);
});

test("floors a fractional index", () => {
  expect(clampIndex(1.9, 3)).toBe(1);
});

test("empty list clamps to 0", () => {
  expect(clampIndex(0, 0)).toBe(0);
  expect(clampIndex(4, 0)).toBe(0);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/components/ui/imageGallery.test.ts`
Expected: FAIL — `Cannot find module './imageGallery'`.

- [ ] **Step 3: Implement `imageGallery.ts`**

Create `src/components/ui/imageGallery.ts`:

```ts
/** Keep an "open at" index inside [0, length). Empty/out-of-range → nearest valid (0). */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return Math.min(length - 1, Math.max(0, Math.floor(index)));
}
```

- [ ] **Step 4: Run the test — it passes**

Run: `npx jest src/components/ui/imageGallery.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create `ImageGalleryModal.tsx`**

Create `src/components/ui/ImageGalleryModal.tsx`:

```tsx
import { useState } from "react";
import {
  Dimensions,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { clampIndex } from "./imageGallery";
import { ZoomableImage } from "./ZoomableImage";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/**
 * Full-screen swipeable image viewer. Rendered only while open (the parent mounts
 * it on tap and unmounts it via `onClose`), so its initial page is set once from
 * props with no effect. Horizontal paging is suspended while the current image is
 * zoomed, so a pan moves within the image instead of turning the page.
 */
export default function ImageGalleryModal({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const start = clampIndex(initialIndex, images.length);
  const [page, setPage] = useState(start);
  const [zoomed, setZoomed] = useState(false);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: start * SCREEN_W, y: 0 }}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {images.map((uri) => (
            <View key={uri} style={styles.page}>
              <ZoomableImage uri={uri} onZoomChange={setZoomed} />
            </View>
          ))}
        </ScrollView>

        <Pressable
          style={styles.close}
          onPress={onClose}
          accessibilityLabel="Fermer"
          hitSlop={12}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        {images.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {images.map((uri, i) => (
              <View key={uri} style={[styles.dot, i === page && styles.dotActive]} />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  page: { width: SCREEN_W, height: SCREEN_H },
  close: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  closeText: { color: "#fff", fontSize: 20, lineHeight: 22 },
  dots: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: { backgroundColor: "#fff" },
});
```

- [ ] **Step 6: Keep the spec in sync**

In `docs/superpowers/specs/2026-07-22-interactive-attachments-design.md`, under `### ImageGalleryModal`, change the props list from the four-prop version to `{ images, initialIndex, onClose }` and note it is mounted only while open (no `visible`).

- [ ] **Step 7: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: clean; jest green including the 4 new `clampIndex` tests.

- [ ] **Step 8: Verify on-device**

Temporarily render `<ImageGalleryModal images={[url1, url2, url3]} initialIndex={1} onClose={...} />` with 2–3 real image URLs behind a button. Confirm: opens on the middle image; horizontal swipe pages between them; dots track the page; pinch-zoom on a page **disables** paging (you pan within the image instead of turning the page); zoom out re-enables paging; ✕ closes. Remove the temporary trigger before committing.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/imageGallery.ts src/components/ui/imageGallery.test.ts src/components/ui/ImageGalleryModal.tsx docs/superpowers/specs/2026-07-22-interactive-attachments-design.md
git commit -m "feat(ui): full-screen swipeable image gallery modal"
```

---

## Task 3: Interactive chat attachments + `threadImageUrls`

**Files:**
- Create: `src/components/ui/chat/threadImages.ts`
- Test: `src/components/ui/chat/threadImages.test.ts`
- Modify: `src/components/ui/chat/ChatThread.tsx`
- Modify: `docs/specs/page-chat.md`

**Interfaces:**
- Consumes: `ImageGalleryModal` (Task 2); `Message`/`MessageAttachment` from `@/lib/firestore/schema`.
- Produces: `threadImageUrls(messages: Message[]): string[]` — every image attachment URL across the thread, in message order, PDFs excluded.

- [ ] **Step 1: Write the failing `threadImageUrls` test**

Create `src/components/ui/chat/threadImages.test.ts`:

```ts
import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import type { Message } from "@/lib/firestore/schema";
import { threadImageUrls } from "./threadImages";

function msg(urls: { type: "image" | "pdf"; url: string }[]): Message {
  return {
    senderId: "u1",
    senderName: "X",
    senderRole: "b2b",
    text: "",
    attachments: urls.map((a) => ({ type: a.type, url: a.url, name: "n", size: 1 })),
    createdAt: Timestamp.now(),
  };
}

test("collects image URLs across the thread in order, excluding PDFs", () => {
  const messages = [
    msg([{ type: "image", url: "a.jpg" }, { type: "pdf", url: "d.pdf" }]),
    msg([]),
    msg([{ type: "image", url: "b.jpg" }, { type: "image", url: "c.jpg" }]),
  ];
  expect(threadImageUrls(messages)).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
});

test("no image attachments → empty list", () => {
  expect(threadImageUrls([msg([{ type: "pdf", url: "d.pdf" }])])).toEqual([]);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/components/ui/chat/threadImages.test.ts`
Expected: FAIL — `Cannot find module './threadImages'`.

- [ ] **Step 3: Implement `threadImages.ts`**

Create `src/components/ui/chat/threadImages.ts`:

```ts
import type { Message } from "@/lib/firestore/schema";

/** Every image attachment URL across the thread, in message order (PDFs excluded). */
export function threadImageUrls(messages: Message[]): string[] {
  return messages.flatMap((m) =>
    m.attachments.filter((a) => a.type === "image").map((a) => a.url),
  );
}
```

- [ ] **Step 4: Run the test — it passes**

Run: `npx jest src/components/ui/chat/threadImages.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Rewire `ChatThread.tsx`**

Replace `src/components/ui/chat/ChatThread.tsx` entirely:

```tsx
import { Image } from "expo-image";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ImageGalleryModal from "@/components/ui/ImageGalleryModal";
import type { Message, MessageAttachment } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import { threadImageUrls } from "./threadImages";

function timeLabel(m: Message): string {
  return m.createdAt.toDate().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function openPdf(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Pièce jointe", "Impossible d'ouvrir le PDF.");
  }
}

function Attachment({
  a,
  onOpenImage,
}: {
  a: MessageAttachment;
  onOpenImage: (url: string) => void;
}) {
  if (a.type === "image") {
    return (
      <Pressable onPress={() => onOpenImage(a.url)}>
        <Image
          source={{ uri: a.url }}
          style={styles.thumb}
          contentFit="cover"
          transition={100}
        />
      </Pressable>
    );
  }
  return (
    <Pressable style={styles.pdf} onPress={() => openPdf(a.url)}>
      <Text style={styles.pdfIcon}>📄</Text>
      <Text style={styles.pdfName} numberOfLines={1}>
        {a.name}
      </Text>
    </Pressable>
  );
}

export default function ChatThread({
  messages,
  currentUserId,
}: {
  messages: Message[];
  currentUserId: string;
}) {
  const images = threadImageUrls(messages);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const openImage = (url: string) => setGalleryIndex(images.indexOf(url));

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m, i) => {
          const mine = m.senderId === currentUserId;
          return (
            <View
              key={`${m.senderId}-${i}`}
              style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}
            >
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                <Text style={[styles.sender, mine && styles.senderMine]}>
                  {m.senderName}
                </Text>
                {m.text ? (
                  <Text style={[styles.text, mine && styles.textMine]}>
                    {m.text}
                  </Text>
                ) : null}
                {m.attachments.map((a) => (
                  <Attachment key={a.url} a={a} onOpenImage={openImage} />
                ))}
                <Text style={[styles.time, mine && styles.timeMine]}>
                  {timeLabel(m)}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {galleryIndex !== null ? (
        <ImageGalleryModal
          images={images}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: tokens.space.md, gap: tokens.space.sm },
  row: { width: "100%" },
  rowMine: { alignItems: "flex-end" },
  rowTheirs: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    gap: tokens.space.xs,
  },
  mine: { backgroundColor: tokens.colors.primary },
  theirs: { backgroundColor: tokens.colors.divider },
  sender: { fontSize: 11, fontWeight: "700", color: tokens.colors.muted },
  senderMine: { color: "rgba(255,255,255,0.7)" },
  text: { fontSize: 15, color: tokens.colors.primary },
  textMine: { color: tokens.colors.primaryText },
  time: { fontSize: 10, color: tokens.colors.muted, alignSelf: "flex-end" },
  timeMine: { color: "rgba(255,255,255,0.6)" },
  thumb: {
    width: 160,
    height: 160,
    borderRadius: tokens.radius.sm,
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  pdf: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.sm,
    backgroundColor: "rgba(0,0,0,0.06)",
    padding: tokens.space.sm,
    borderRadius: tokens.radius.sm,
  },
  pdfIcon: { fontSize: 28 },
  pdfName: { fontSize: 13, flex: 1, color: tokens.colors.primary },
});
```

- [ ] **Step 6: Update the chat spec**

In `docs/specs/page-chat.md`, replace the main-section bullet "scrollable view with all chats and file attached (represented by an file icon)" with a description that attachments are interactive: image attachments show a tappable thumbnail that opens a full-screen swipeable gallery (spanning all the thread's photos), and PDF attachments show a tappable icon that opens the device's default PDF reader.

- [ ] **Step 7: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: clean; jest green including the 2 new `threadImageUrls` tests.

- [ ] **Step 8: Verify on-device**

Emulators running + seeded, dev client on. In a dossier chat that has an image and a PDF message: the image renders as a thumbnail — tap it → full-screen gallery opens on that image and swipes across every image in the thread, with pinch-zoom; the PDF renders as an icon + name — tap it → the system opens the PDF. Send a new image/PDF and confirm the same live.

- [ ] **Step 9: Commit**

```bash
git add src/components/ui/chat/threadImages.ts src/components/ui/chat/threadImages.test.ts src/components/ui/chat/ChatThread.tsx docs/specs/page-chat.md
git commit -m "feat(chat): tappable image thumbnails (gallery) and PDF attachments"
```

---

## Task 4: Tappable dossier `PhotoCarousel`

**Files:**
- Modify: `src/components/ui/PhotoCarousel.tsx`
- Modify: `docs/specs/page-dossier.md`

**Interfaces:**
- Consumes: `ImageGalleryModal` (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Make carousel photos open the gallery**

Replace `src/components/ui/PhotoCarousel.tsx` entirely:

```tsx
import { Image } from "expo-image";
import { useState } from "react";
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import ImageGalleryModal from "./ImageGalleryModal";
import StatusBadge from "./StatusBadge";

const W = Dimensions.get("window").width;

export default function PhotoCarousel({
  photos,
  status,
}: {
  photos: string[];
  status?: DossierStatus;
}) {
  const [index, setIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / W));

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {photos.map((uri, i) => (
          <Pressable key={uri} onPress={() => setGalleryIndex(i)}>
            <Image
              source={{ uri }}
              style={styles.photo}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        ))}
      </ScrollView>
      {status ? (
        <View style={styles.badge}>
          <StatusBadge status={status} />
        </View>
      ) : null}
      <View style={styles.dots} pointerEvents="none">
        {photos.map((uri, i) => (
          <View key={uri} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {galleryIndex !== null ? (
        <ImageGalleryModal
          images={photos}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: W * 0.75, backgroundColor: tokens.colors.divider },
  photo: { width: W, height: W * 0.75 },
  badge: { position: "absolute", top: tokens.space.md, right: tokens.space.md },
  dots: {
    position: "absolute",
    bottom: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: { backgroundColor: tokens.colors.bg },
});
```

> Note: `dots` gained `pointerEvents="none"` so the overlay never swallows a tap meant for the photo underneath. Everything else is unchanged from the original except the `Pressable` wrapper and the modal.

- [ ] **Step 2: Update the dossier spec**

In `docs/specs/page-dossier.md`, note that the photo carousel is interactive: tapping a photo opens it full-screen in a swipeable, pinch-to-zoom gallery of the dossier's photos.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (No unit test — UI only.)

- [ ] **Step 4: Verify on-device**

Open a dossier detail screen with photos. Tap a carousel photo → it opens full-screen in the gallery at that photo; swipe through all the dossier's photos; pinch-zoom works; ✕ closes back to the detail screen.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PhotoCarousel.tsx docs/specs/page-dossier.md
git commit -m "feat(dossier): tap a carousel photo to open the full-screen gallery"
```

---

## Self-review notes (author)

- **Spec coverage:** reusable viewer → Tasks 1–2 (`ZoomableImage` + `ImageGalleryModal`); pinch/double-tap zoom + pan bounds → Task 1; whole-thread chat gallery + PDF-via-Linking + thumbnail → Task 3 (`threadImageUrls`); tappable dossier carousel → Task 4; spec sync (`page-chat.md`, `page-dossier.md`, and the `ImageGalleryModal` interface) → Tasks 2/3/4. Gesture-coordination de-risk (paging suspended while zoomed) → Tasks 1–2, verified on-device in Task 2 Step 8.
- **Type consistency:** `ZoomableImage({ uri, onZoomChange })`, `clampIndex(index, length)`, `ImageGalleryModal({ images, initialIndex, onClose })`, `threadImageUrls(messages)` are used with identical signatures at every call site.
- **Deliberate spec refinement:** `ImageGalleryModal` drops the spec's `visible` prop for parent-controlled mounting — avoids a sync `setState`-in-effect (which `expo lint` rejects) and makes reopening at a new index correct without an effect. Spec updated in Task 2 Step 6.
- **Deliberate fix to the provided snippet:** the owner's `ZoomableImage` put the animated style on the `expo-image` (not an Animated component, so it wouldn't animate); Task 1 applies it to a wrapping `Animated.View`. It also adds a scale cap and pan bounds (spec refinements).
- **Testing scope:** only `clampIndex` and `threadImageUrls` are unit-tested (pure). The gesture/Modal/native-open surface is verified on-device per task — no mock-only tests. Task 1 Step 4 is the reanimated-worklet + gesture de-risk gate.
- **No new dependencies; no babel config** — confirmed against the Expo SDK 56 reanimated docs (plugin ships with `babel-preset-expo`).
