import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tokens } from "@/theme/tokens";

type Provider = "google" | "apple" | "facebook";
const LABELS: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
};

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
      {(["google", "apple", "facebook"] as Provider[]).map((p) => (
        <TouchableOpacity
          key={p}
          style={styles.btn}
          onPress={() => onPress(p)}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>{LABELS[p]}</Text>
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
  btnText: { fontSize: 16, fontWeight: "600", color: tokens.colors.primary },
});
