import SettingsList from "@/components/form/SettingsList";
import type { UserRole } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import { ScrollView, StyleSheet } from "react-native";

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
    <ScrollView contentContainerStyle={styles.content}>
      <SettingsList
        role={role}
        onInvite={onInvite}
        onManageCompanies={onManageCompanies}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
