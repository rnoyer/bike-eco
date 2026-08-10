import { Image } from "expo-image";
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, { type AnimatedStyle } from "react-native-reanimated";

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
  iconStyle,
  expanded,
}: {
  /** A required SVG module, e.g. `require("@/assets/images/icons/phone.svg")`. */
  icon: number;
  /** Icon-only, so without this the button is unreachable by a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  /** Applied to an `Animated.View` around the glyph — for `InfoCollapsibleRow`'s
   *  rotating chevron. It sits on a wrapper because `expo-image`'s `Image` is
   *  not an Animated component (see `ZoomableImage`), and on the *glyph* rather
   *  than the button so the green box's `radius.sm` corners don't swing. */
  iconStyle?: StyleProp<AnimatedStyle<ViewStyle>>;
  /** Announced to screen readers by a button that expands a disclosure. */
  expanded?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Animated.View style={iconStyle}>
        <Image
          source={icon}
          style={styles.icon}
          tintColor={tokens.colors.primary}
          contentFit="contain"
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: tokens.space.md,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.rowAction,
  },
  pressed: { backgroundColor: tokens.colors.rowActionPressed },
  disabled: { opacity: 0.5 },
  icon: { width: 22, height: 22 },
});
