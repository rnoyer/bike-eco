import { Image } from "expo-image";
import {
  TabList,
  TabSlot,
  TabTrigger,
  Tabs,
  type TabTriggerSlotProps,
} from "expo-router/ui";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { TabConfig } from "@/lib/navigation/tabs";
import { tokens } from "@/theme/tokens";

/**
 * The web bottom tab bar.
 *
 * Web can't use `NativeTabs`: expo-router's web renderer for it draws a
 * `position: fixed; top: 24px` pill that lands behind the group Stack's 64px header —
 * and loses the stacking contest to it, because every react-native-web `View` sets
 * `z-index: 0`, so the pill's own `z-index: 10` only applies inside the content
 * subtree. It also renders labels only, dropping the `sf` / `md` icons.
 *
 * So web gets a real bottom bar built from `expo-router/ui`, laid out in normal flow
 * below `TabSlot` — no fixed positioning, hence no stacking fight possible.
 * Native keeps `NativeTabs` via `GroupTabs.native.tsx`.
 */
export default function GroupTabs({ tabs }: { tabs: TabConfig[] }) {
  const insets = useSafeAreaInsets();

  return (
    <Tabs style={styles.container}>
      <TabSlot style={styles.slot} />
      <TabList style={[styles.bar, { paddingBottom: insets.bottom }]}>
        {tabs.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton icon={tab.icon}>{tab.label}</TabButton>
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = TabTriggerSlotProps & Pick<TabConfig, "icon">;

/** `TabTrigger` forwards `isFocused` and the press handlers through `asChild`. */
function TabButton({ icon, children, isFocused, ...props }: TabButtonProps) {
  const tint = isFocused ? tokens.colors.primary : tokens.colors.muted;

  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      style={styles.tab}
    >
      <Image
        source={icon}
        style={styles.icon}
        tintColor={tint}
        contentFit="contain"
      />
      <Text style={[styles.label, { color: tint }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slot: { flex: 1 },
  bar: {
    flexDirection: "row",
    backgroundColor: tokens.colors.surface,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.space.xs,
    paddingVertical: tokens.space.sm,
  },
  icon: { width: 24, height: 24 },
  label: { fontSize: 12, fontWeight: "500" },
});
