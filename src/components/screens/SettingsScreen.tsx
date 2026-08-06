import SettingsList from "@/components/form/SettingsList";
import type { UserRole } from "@/lib/firestore/schema";
import { ScrollView } from "react-native";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onManageCompanies?: () => void;
  onManageColleagues: () => void;
}

export default function SettingsScreen({
  role,
  onInvite,
  onManageCompanies,
  onManageColleagues,
}: Props) {
  return (
    <ScrollView>
      <SettingsList
        role={role}
        onInvite={onInvite}
        onManageCompanies={onManageCompanies}
        onManageColleagues={onManageColleagues}
      />
    </ScrollView>
  );
}
