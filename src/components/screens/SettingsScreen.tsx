import { ScrollView, StyleSheet } from "react-native";
import SettingsList from "@/components/form/SettingsList";
import type { UserRole } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onDelete: () => void;
  onSignOut: () => void;
  onManageCompanies?: () => void;
}

export default function SettingsScreen({ role, onInvite, onDelete, onSignOut, onManageCompanies }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SettingsList
        role={role}
        onInvite={onInvite}
        onDelete={onDelete}
        onSignOut={onSignOut}
        onManageCompanies={onManageCompanies}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
