import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
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
  busy = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();

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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        // A number pad has no return key, and `FormField` drops the toolbar iOS would
        // otherwise build to carry one — so dragging the form is what closes it.
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.fields}>{children}</View>
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
