import { useGlobalSearchParams } from "expo-router";

import GroupTabs from "@/components/navigation/GroupTabs";
import { b2bDossierTabs } from "@/lib/navigation/tabs";

export default function B2bDossierTabs() {
  // Global, not local: the `[id]` is shared across the tab screens under this layout.
  const { id } = useGlobalSearchParams<{ id: string }>();

  return <GroupTabs tabs={b2bDossierTabs(id ?? "")} />;
}
