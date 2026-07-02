import { Platform, Pressable, StyleSheet, Text } from "react-native";
import { tokens } from "@/theme/tokens";

/**
 * A back chevron for a Stack header's `headerLeft`. Used where the target isn't a
 * stack pop (switching between sibling `NativeTabs`), so the native back button
 * can't be reused. Renders the platform-appropriate glyph.
 */
export default function HeaderBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Retour"
    >
      <Text style={styles.glyph}>{Platform.OS === "ios" ? "‹" : "←"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  glyph: {
    fontSize: Platform.OS === "ios" ? 32 : 24,
    color: tokens.colors.primary,
    paddingHorizontal: 4,
  },
});
