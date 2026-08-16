import type { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  children: ReactNode;
  /** Paints the area outside the column. Defaults to the app frame's charcoal. */
  pageStyle?: StyleProp<ViewStyle>;
  columnStyle?: StyleProp<ViewStyle>;
}

/**
 * Web only: a desktop browser is far wider than any screen this UI was drawn
 * for, so its content is capped at `tokens.layout.maxContentWidth` and centred,
 * over a page painted in `primary` so the excess reads as the app's own frame.
 * On native it is a passthrough: no wrapper view, no extra layout pass.
 *
 * The root layout wraps the whole navigator in one — but react-native-web
 * renders `Modal` through a portal appended to `document.body`, so a modal
 * escapes that wrapper entirely and has to declare its own. Every full-screen
 * modal surface therefore uses this too; without it a funnel dropdown or the
 * image viewer covers the whole browser window while the app behind it is a
 * narrow column.
 */
export default function WebColumn({ children, pageStyle, columnStyle }: Props) {
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View style={[styles.page, pageStyle]}>
      <View style={[styles.column, columnStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: tokens.colors.primary },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: tokens.layout.maxContentWidth,
    alignSelf: "center",
    overflow: "hidden",
  },
});
