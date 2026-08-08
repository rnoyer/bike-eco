import { Image } from "expo-image";
import { Pressable, StyleSheet } from "react-native";

import { tokens } from "@/theme/tokens";

/**
 * The app's one icon-only action button: the phone/email buttons in
 * `InfoContactRow` and the subscription bell over the dossier carousel.
 *
 * Filled with the brand green, not outlined: a hairline box around a dark glyph
 * read as a disabled placeholder rather than the row's one action.
 * Charcoal-on-green is the logo's own pairing, and 6.3:1.
 */
export default function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  /** A required SVG module, e.g. `require("@/assets/images/icons/phone.svg")`. */
  icon: number;
  /** Icon-only, so without this the button is unreachable by a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Image
        source={icon}
        style={styles.icon}
        tintColor={tokens.colors.primary}
        contentFit="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: tokens.space.md,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brandTint,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  pressed: { backgroundColor: tokens.colors.brandPressed },
  disabled: { opacity: 0.5 },
  icon: { width: 22, height: 22 },
});
