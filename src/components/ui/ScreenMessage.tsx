import { tokens } from "@/theme/tokens";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

interface Props {
  /** Already-French copy — a mapped hook error, or a "…introuvable." line. */
  message: string;
  /** `danger` for a failed read, `muted` for an expected empty/not-found. */
  tone?: "muted" | "danger";
  style?: StyleProp<TextStyle>;
}

/** Screen-level counterpart to `Section`'s error/empty states: the whole screen
 *  has nothing to show, and says why. Pairs with `ScreenLoader`. */
export default function ScreenMessage({
  message,
  tone = "muted",
  style,
}: Props) {
  return (
    <Text style={[styles.message, tone === "danger" && styles.danger, style]}>
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  message: {
    flex: 1,
    textAlign: "center",
    textAlignVertical: "center",
    padding: tokens.space.xl,
    fontSize: 14,
    color: tokens.colors.muted,
  },
  danger: { color: tokens.colors.danger },
});
