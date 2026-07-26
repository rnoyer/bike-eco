import GroupTabs from "@/components/navigation/GroupTabs";
import { BACKOFFICE_TABS } from "@/lib/navigation/tabs";

export default function BackofficeTabsLayout() {
  return <GroupTabs tabs={BACKOFFICE_TABS} />;
}
