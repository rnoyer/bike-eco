import { tokens } from "@/theme/tokens";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

interface Props {
  /** Already-French copy — a mapped hook error, or a "…introuvable." line. */
  message: string;
  /** `danger` for a failed read, `muted` for an expected empty/not-found. */
  tone?: "muted" | "danger";
  style?: StyleProp<ViewStyle>;
}

/** Screen-level counterpart to `Section`'s error/empty states: the whole screen
 *  has nothing to show, and says why. Pairs with `ScreenLoader`. */
export default function ScreenMessage({
  message,
  tone = "muted",
  style,
}: Props) {
  return (
    <View style={[styles.screen, style]}>
      <Text style={[styles.message, tone === "danger" && styles.danger]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors `ScreenLoader`: centring has to come from a flex container, because
  // `flex: 1` does nothing inside a ScrollView's content and `textAlignVertical`
  // is Android-only — together they left this top-aligned on iOS.
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.space.xl,
    paddingVertical: 48,
  },
  message: {
    textAlign: "center",
    fontSize: 14,
    color: tokens.colors.muted,
  },
  danger: { color: tokens.colors.danger },
});
