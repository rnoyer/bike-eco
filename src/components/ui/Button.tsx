import Spinner from "@/components/ui/Spinner";
import { tokens } from "@/theme/tokens";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";

type Variant = "primary" | "outlined" | "danger" | "text";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** An action is in flight: swaps the label for a spinner and blocks presses.
   *  Prefer this over `disabled` for a network round-trip — `disabled` only
   *  dims, which reads as "unavailable", not as "working". */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Token-styled button for the RN form/settings screens. `primary`/`outlined`
 *  are full-height CTAs; `text` is a compact link-style action. */
export default function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
}: Props) {
  const onDark = variant === "primary" || variant === "danger";
  const blocked = disabled || loading;
  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "outlined" && styles.outlined,
        variant === "danger" && styles.danger,
        variant === "text" && styles.text,
        // Dim only when unavailable. A spinning button is working, not
        // disabled, and dimming it as well reads as broken — which matters
        // where a screen locks every button while one of them acts: the
        // acting button spins undimmed, its siblings dim.
        disabled && !loading && styles.disabled,
        style,
      ]}
      onPress={blocked ? undefined : onPress}
      activeOpacity={blocked ? 1 : 0.8}
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      accessibilityLabel={label}
    >
      {loading ? (
        <Spinner
          color={onDark ? tokens.colors.primaryText : tokens.colors.primary}
        />
      ) : (
        <Text style={[styles.label, onDark && styles.labelPrimary]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    height: tokens.button.height,
    backgroundColor: tokens.colors.primary,
  },
  danger: {
    height: tokens.button.height,
    backgroundColor: tokens.colors.danger,
  },
  outlined: {
    height: tokens.button.height,
    borderWidth: 1.5,
    backgroundColor: tokens.colors.surfaceAlt,
    borderColor: tokens.colors.border,
  },
  text: {
    alignSelf: "flex-start",
    paddingVertical: tokens.space.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: tokens.colors.primary,
  },
  labelPrimary: {
    color: tokens.colors.primaryText,
  },
});
