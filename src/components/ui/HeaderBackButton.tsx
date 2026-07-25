import { tokens } from "@/theme/tokens";
import { Image } from "expo-image";
import { Pressable, StyleSheet } from "react-native";

import arrowBack from "@/assets/images/icons/arrow_back_android.svg";

/**
 * A back arrow for a Stack header's `headerLeft`. Used where the target isn't a
 * stack pop (switching between sibling `NativeTabs`), so the native back button
 * can't be reused.
 */
export default function HeaderBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Retour"
      style={styles.button}
    >
      <Image
        source={arrowBack}
        style={styles.icon}
        tintColor={tokens.colors.primary}
        contentFit="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingRight: 32,
  },
  icon: {
    width: 24,
    height: 24,
  },
});
