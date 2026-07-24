import SettingsList from "@/components/form/SettingsList";
import type { UserRole } from "@/lib/firestore/schema";
import { ScrollView } from "react-native";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onManageCompanies?: () => void;
}

export default function SettingsScreen({
  role,
  onInvite,
  onManageCompanies,
}: Props) {
  return (
    <ScrollView>
      <SettingsList
        role={role}
        onInvite={onInvite}
        onManageCompanies={onManageCompanies}
      />
    </ScrollView>
  );
}
