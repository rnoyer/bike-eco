import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Dossier } from "@/lib/firestore/schema";
import type { WithId } from "@/lib/data/fixtures";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  dossiers: WithId<Dossier>[];
  loading: boolean;
  emptyMessage: string;
  renderCard: (d: WithId<Dossier>) => ReactNode;
}

export default function DossiersSection({
  title,
  dossiers,
  loading,
  emptyMessage,
  renderCard,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : dossiers.length === 0 ? (
        <Text style={styles.empty}>{emptyMessage}</Text>
      ) : (
        <View style={styles.list}>{dossiers.map(renderCard)}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.space.md },
  title: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
  spinner: { paddingVertical: tokens.space.lg },
  empty: { fontSize: 14, color: tokens.colors.muted },
  list: { gap: tokens.space.md },
});
