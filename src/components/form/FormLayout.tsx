import React, { useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import { useKeyboardOpen } from "@/lib/ui/useKeyboardOpen";
import { tokens } from "@/theme/tokens";

interface Props {
  progress: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  nextLabel?: string;
  /** Rendered at the end of the scroll, under the fields and directly above the
   *  Précédent / Suivant bar. For the last step's `LegalNotice` — it scrolls
   *  with the form rather than pinning itself to the bar, which on a small
   *  screen with the keyboard up would cost three more lines of fixed chrome. */
  footer?: React.ReactNode;
  /** The submit is in flight: the primary button spins and both nav buttons
   *  lock. Feed it `useStepForm`'s `submitting` — without it the funnel's
   *  longest actions (both photo uploads) leave the button looking idle. */
  busy?: boolean;
}

export default function FormLayout({
  progress,
  title,
  subtitle,
  children,
  onPrev,
  onNext,
  nextLabel = "Suivant",
  footer,
  busy = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);

  // Bring the focused field into view once the keyboard is up. Only iOS needs
  // this: Android's native ScrollView scrolls a focused descendant onto screen
  // itself, while iOS leaves the offset where it was and the field ends up
  // behind the keyboard — which is exactly the bug this fixes.
  //
  // `KeyboardAvoidingView` has already shrunk this ScrollView, so its visible
  // window excludes both the keyboard and the button bar; all that is missing is
  // putting the field inside it. Hence `keyboardDidShow` (via `useKeyboardOpen`)
  // rather than the field's own `onFocus`: focus fires before the lift, when the
  // window is still full height and the measurements would be stale.
  //
  // Never runs on web — react-native-web's `Keyboard` is a stub whose listeners
  // never fire, so `keyboardOpen` stays false there. Just as well: RNW's
  // `TextInput.State` has no `currentlyFocusedInput`.
  useEffect(() => {
    if (!keyboardOpen) return;
    const input = TextInput.State.currentlyFocusedInput();
    const scroll = scrollRef.current;
    // The `ScrollView` component itself is not measurable — the native view it
    // wraps is, and that view's frame is the visible window we are aiming for.
    const viewport = scroll?.getNativeScrollRef();
    if (!input || !scroll || !viewport) return;

    viewport.measureInWindow((_x, viewportY, _w, viewportHeight) => {
      input.measureInWindow((_ix, inputY, _iw, inputHeight) => {
        const margin = tokens.space.md;
        const toRevealBottom =
          inputY + inputHeight + margin - (viewportY + viewportHeight);
        const toRevealTop = inputY - viewportY - margin;
        // The smaller of the two: show the bottom of a field that fits, but the
        // top of one taller than the window — bottom-aligning a long
        // "Commentaires" box would push the first line off the top instead.
        const delta = Math.min(toRevealBottom, toRevealTop);
        if (delta > 0) {
          scroll.scrollTo({ y: scrollOffset.current + delta, animated: true });
        }
      });
    });
  }, [keyboardOpen]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Progress bar — fixed above the scroll, so it stays put while the form scrolls. */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progress}%` as any }]}
          />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        // Tracked so the reveal above can scroll relative to where the form
        // already is; `scrollTo` takes an absolute offset.
        onScroll={(e) => {
          scrollOffset.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        // A number pad has no return key, and `FormField` drops the toolbar iOS would
        // otherwise build to carry one — so dragging the form is what closes it.
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.fields}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>

      {/* The bar rides above the keyboard, so while the keyboard is up it must drop
       *  the home-indicator inset the keys already cover — and it tightens its own
       *  padding, because 16 + 52 + 34 + 16 of chrome above a raised keyboard leaves
       *  almost nothing of the form on a small screen. */}
      <View
        style={[
          styles.buttons,
          keyboardOpen
            ? { paddingTop: tokens.space.md, paddingBottom: tokens.space.md }
            : { paddingBottom: insets.bottom + 16 },
        ]}
      >
        <Button
          variant="outlined"
          label="Précédent"
          onPress={onPrev}
          disabled={busy}
          style={styles.btn}
        />
        <Button
          label={nextLabel}
          onPress={onNext}
          loading={busy}
          style={styles.btn}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
  },
  header: {
    paddingHorizontal: tokens.space.lg,
    paddingBottom: 16,
    backgroundColor: tokens.colors.surface,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: tokens.space.lg,
    paddingTop: 8,
    paddingBottom: 32,
  },
  progressTrack: {
    height: 6,
    backgroundColor: tokens.colors.border,
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    height: "100%",
    backgroundColor: tokens.colors.primary,
    borderRadius: 3,
  },
  title: {
    ...tokens.text.title,
    marginBottom: tokens.space.sm,
  },
  subtitle: {
    ...tokens.text.subtitle,
    marginBottom: tokens.space.xl,
  },
  fields: {
    gap: 20,
  },
  footer: {
    marginTop: tokens.space.lg,
  },
  buttons: {
    flexDirection: "row",
    gap: tokens.space.md,
    paddingHorizontal: tokens.space.lg,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.divider,
    backgroundColor: tokens.colors.surface,
  },
  // `ui/Button` owns height, radius and alignment; the row only shares width.
  btn: { flex: 1 },
});
