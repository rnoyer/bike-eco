import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  message?: string;
  buttonLabel: string;
  onDone: () => void;
}

/** Button-driven terminal screen shown at the end of a form funnel. */
export default function FormConfirmation({
  title,
  message,
  buttonLabel,
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.subtitle}>{message}</Text> : null}
      </View>
      <TouchableOpacity style={styles.btn} onPress={onDone} activeOpacity={0.8}>
        <Text style={styles.btnText}>{buttonLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.surface,
    paddingHorizontal: tokens.space.lg,
  },
  body: { flex: 1, justifyContent: "center" },
  title: { ...tokens.text.title, marginBottom: tokens.space.md },
  subtitle: { ...tokens.text.subtitle, lineHeight: 20 },
  btn: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.primary,
  },
  btnText: { fontSize: 16, fontWeight: "600", color: tokens.colors.primaryText },
});
