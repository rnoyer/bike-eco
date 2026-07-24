import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tokens } from "@/theme/tokens";

type Provider = "google" | "apple" | "facebook";

const PROVIDERS: { id: Provider; label: string; enabled: boolean }[] = [
  { id: "google", label: "Google", enabled: true },
  { id: "apple", label: "Apple — bientôt disponible", enabled: false },
  { id: "facebook", label: "Facebook — bientôt disponible", enabled: false },
];

export default function ThirdPartyAuthButtons({
  onPress,
}: {
  onPress: (provider: Provider) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.or}>Ou continuez avec</Text>
        <View style={styles.line} />
      </View>
      {PROVIDERS.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.btn, !p.enabled && styles.btnDisabled]}
          disabled={!p.enabled}
          onPress={() => p.enabled && onPress(p.id)}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>{p.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.md },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: tokens.space.md },
  line: { flex: 1, height: 1, backgroundColor: tokens.colors.border },
  or: { fontSize: 13, color: tokens.colors.muted },
  btn: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "600", color: tokens.colors.primary },
});
