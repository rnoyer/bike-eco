import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  companies: WithId<Company>[];
  loading: boolean;
  emptyMessage: string;
  renderCard: (c: WithId<Company>) => ReactNode;
}

export default function CompaniesSection({
  title, companies, loading, emptyMessage, renderCard,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : companies.length === 0 ? (
        <Text style={styles.empty}>{emptyMessage}</Text>
      ) : (
        <View style={styles.list}>{companies.map(renderCard)}</View>
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
