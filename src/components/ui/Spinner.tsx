import { tokens } from "@/theme/tokens";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

interface SpinnerProps {
  size?: "small" | "large";
  /** Defaults to the primary colour; pass `primaryText` on a dark surface. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** The app's only spinner. Never render a bare `ActivityIndicator`: this owns
 *  the token colour so a palette change reaches every loading state at once. */
export default function Spinner({
  size = "small",
  color = tokens.colors.primary,
  style,
}: SpinnerProps) {
  return <ActivityIndicator size={size} color={color} style={style} />;
}

/** Whole-screen (or whole-region) read state: a centred spinner with enough
 *  padding to read as "this area is loading" rather than as a stray dot. Use it
 *  wherever a screen would otherwise `return null` while its hook resolves —
 *  `null` renders as a blank screen, which reads as a bug. */
export function ScreenLoader({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.screen, style]}>
      <Spinner size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  // `flex: 1` fills a plain parent; the padding is what gives it presence
  // inside a ScrollView content container, where `flex: 1` does nothing.
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
});
