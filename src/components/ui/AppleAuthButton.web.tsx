import { tokens } from "@/theme/tokens";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

/**
 * Web has no native Apple button, so this is the custom one the Human Interface
 * Guidelines permit: Apple's official logo, an approved title, and the
 * white-with-outline treatment the rest of this row uses. The title must stay
 * one of Apple's approved strings — "Continuer avec Apple" or "Se connecter avec
 * Apple". "Apple" on its own is not approved.
 */
export default function AppleAuthButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={require("@/assets/images/icons/appleIcon.svg")}
        style={styles.btnIcon}
        contentFit="contain"
      />
      <Text style={styles.btnText}>Continuer avec Apple</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
