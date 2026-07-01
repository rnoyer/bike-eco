import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/theme/tokens";

interface Props {
  progress: number;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onPrev: () => void;
  onNext: () => void;
  canGoBack?: boolean;
  nextLabel?: string;
}

export default function FormLayout({
  progress,
  title,
  subtitle,
  children,
  onPrev,
  onNext,
  canGoBack = true,
  nextLabel = "Suivant",
}: Props) {
  const insets = useSafeAreaInsets();

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
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        <View style={styles.fields}>{children}</View>
      </ScrollView>

      <View style={[styles.buttons, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[
            styles.btn,
            styles.btnSecondary,
            !canGoBack && styles.btnDisabled,
          ]}
          onPress={canGoBack ? onPrev : undefined}
          activeOpacity={canGoBack ? 0.7 : 1}
        >
          <Text style={[styles.btnText, !canGoBack && styles.btnTextDisabled]}>
            Précédent
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={onNext}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnText, styles.btnTextPrimary]}>
            {nextLabel}
          </Text>
        </TouchableOpacity>
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
  btn: {
    flex: 1,
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: tokens.colors.primary,
  },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
  },
  btnDisabled: {
    borderColor: tokens.colors.divider,
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.colors.primary,
  },
  btnTextPrimary: {
    color: tokens.colors.primaryText,
  },
  btnTextDisabled: {
    color: tokens.colors.disabled,
  },
});
