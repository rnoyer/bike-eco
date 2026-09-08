import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * The space a screen inside the native tab bar must keep free at its bottom.
 *
 * iOS 26 draws the tab bar as translucent glass *over* the screen. `NativeTabs`
 * turns on automatic content-inset adjustment for the first `ScrollView` of a
 * tab screen, which is enough for a list — it can be scrolled clear of the bar —
 * but that inset never reaches layout: Yoga still measures the content container
 * against the full scroll-view frame, so anything pinned to the bottom with
 * `marginTop: "auto"` is laid out behind the glass and stays there. A screen
 * that pins content has to reserve the space itself.
 *
 * iOS is also the only platform where `insets.bottom` knows about the tab bar:
 * `NativeTabs` wraps each iOS tab screen in its own `SafeAreaProvider`, so the
 * inset measured from inside a tab screen is the bar plus the home indicator,
 * not the root window's home indicator alone.
 *
 * Android needs nothing — the tab bar is opaque and `NativeTabs` already wraps
 * the screen in a `SafeAreaView` applying the bottom inset, so returning the
 * (window) inset here would double it. Neither does web, whose tab bar is laid
 * out in normal flow below the content; see `GroupTabs`.
 */
export function useTabBarInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "ios" ? insets.bottom : 0;
}
