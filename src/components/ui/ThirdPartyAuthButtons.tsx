import AppleAuthButton from "@/components/ui/AppleAuthButton";
import type { AuthProviderId } from "@/lib/auth/providerEmail";
import { tokens } from "@/theme/tokens";
import { Image, type ImageProps } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PROVIDERS: {
  id: AuthProviderId;
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
  // {
  //   id: "facebook",
  //   label: "Facebook",
  //   icon: require("@/assets/images/icons/facebookIcon.svg"),
  //   enabled: false,
  // },
];

export default function ThirdPartyAuthButtons({
  onPress,
  disabled = false,
}: {
  onPress: (provider: AuthProviderId) => void;
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
      {/* Apple is not a row entry: iOS must use Apple's own button component,
          and Android shows none at all, so it is a platform-split component
          rather than another `PROVIDERS` row. */}
      <AppleAuthButton onPress={() => onPress("apple")} disabled={disabled} />
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
