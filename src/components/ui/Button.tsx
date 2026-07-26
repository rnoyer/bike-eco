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
  style?: StyleProp<ViewStyle>;
}

/** Token-styled button for the RN form/settings screens. `primary`/`outlined`
 *  are full-height CTAs; `text` is a compact link-style action. */
export default function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  style,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        variant === "primary" && styles.primary,
        variant === "outlined" && styles.outlined,
        variant === "danger" && styles.danger,
        variant === "text" && styles.text,
        disabled && styles.disabled,
        style,
      ]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.8}
    >
      <Text
        style={[
          styles.label,
          (variant === "primary" || variant === "danger") &&
            styles.labelPrimary,
        ]}
      >
        {label}
      </Text>
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
