import { NativeTabs } from "expo-router/unstable-native-tabs";

import type { TabConfig } from "@/lib/navigation/tabs";

/**
 * The real native bottom tab bar (UITabBar on iOS, BottomNavigation on Android).
 *
 * Web gets `GroupTabs.tsx` instead: expo-router's web renderer for `NativeTabs` draws a
 * `position: fixed; top: 24px` pill rather than a bottom bar, and drops the icons.
 */
export default function GroupTabs({ tabs }: { tabs: TabConfig[] }) {
  return (
    <NativeTabs>
      {tabs.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.md} />
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
