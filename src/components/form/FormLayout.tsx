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
    backgroundColor: "#fff",
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#fff",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    position: "absolute",
    left: 0,
    height: "100%",
    backgroundColor: "#111",
    borderRadius: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "400",
    color: "#71727A",
    marginBottom: 28,
  },
  fields: {
    gap: 20,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    backgroundColor: "#fff",
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: {
    backgroundColor: "#111",
  },
  btnSecondary: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  btnDisabled: {
    borderColor: "#F3F4F6",
  },
  btnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },
  btnTextPrimary: {
    color: "#fff",
  },
  btnTextDisabled: {
    color: "#C1C1C6",
  },
});
