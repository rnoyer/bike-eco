import GroupTabs from "@/components/navigation/GroupTabs";
import { B2B_TABS } from "@/lib/navigation/tabs";

export default function B2bTabsLayout() {
  return <GroupTabs tabs={B2B_TABS} />;
}
