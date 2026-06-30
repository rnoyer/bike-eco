import { Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import SettingsList from "@/components/native/SettingsList";
import type { UserRole } from "@/lib/firestore/schema";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onDelete: () => void;
}

export default function SettingsScreen({ role, onInvite, onDelete }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Paramètres", back: false })} />
      <SettingsList role={role} onInvite={onInvite} onDelete={onDelete} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
