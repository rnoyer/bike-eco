import SettingsList from "@/components/form/SettingsList";
import { useIsAdmin } from "@/lib/data/useIsAdmin";
import type { UserRole } from "@/lib/firestore/schema";
import { ScrollView } from "react-native";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onManageCompanies?: () => void;
  /** Opens the colleague management page. Only ever called for an admin. */
  onManageColleague: (uid: string) => void;
}

export default function SettingsScreen({
  role,
  onInvite,
  onManageCompanies,
  onManageColleague,
}: Props) {
  const isAdmin = useIsAdmin();

  return (
    <ScrollView>
      <SettingsList
        role={role}
        isAdmin={isAdmin}
        onInvite={onInvite}
        onManageCompanies={onManageCompanies}
        onManageColleague={onManageColleague}
      />
    </ScrollView>
  );
}
