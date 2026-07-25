import { tokens } from "@/theme/tokens";
import { Image, type ImageProps } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Provider = "google" | "apple" | "facebook";

const PROVIDERS: {
  id: Provider;
  label: string;
  /** Brand mark rendered just before the label. */
  icon: ImageProps["source"];
  enabled: boolean;
}[] = [
  {
    id: "google",
    label: "Google",
    icon: require("@/assets/images/icons/googleIcon.svg"),
    enabled: true,
  },
  // { id: "apple", label: "Apple — bientôt disponible", icon: require("@/assets/images/icons/appleIcon.svg"), enabled: false },
  // { id: "facebook", label: "Facebook — bientôt disponible", icon: require("@/assets/images/icons/facebookIcon.svg"), enabled: false },
];

export default function ThirdPartyAuthButtons({
  onPress,
  disabled = false,
}: {
  onPress: (provider: Provider) => void;
  /** Locks every provider while a sign-in round-trip is in flight. */
  disabled?: boolean;
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
          style={[styles.btn, (!p.enabled || disabled) && styles.btnDisabled]}
          disabled={!p.enabled || disabled}
          onPress={() => p.enabled && !disabled && onPress(p.id)}
          activeOpacity={0.7}
        >
          <Image source={p.icon} style={styles.btnIcon} contentFit="contain" />
          <Text style={styles.btnText}>{p.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.md },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.md,
  },
  line: { flex: 1, height: 1, backgroundColor: tokens.colors.border },
  or: { fontSize: 13, color: tokens.colors.muted },
  btn: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnIcon: { width: 20, height: 20 },
  btnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: tokens.colors.primary,
    textAlign: "center",
  },
});
