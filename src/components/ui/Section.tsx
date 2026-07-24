import { Children, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  loading?: boolean;
  emptyMessage?: string;
  children?: ReactNode;
}

export default function Section({
  title,
  loading,
  emptyMessage,
  children,
}: Props) {
  const isEmpty = Children.count(children) === 0;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : isEmpty && emptyMessage ? (
        <Text style={styles.empty}>{emptyMessage}</Text>
      ) : (
        <View style={styles.list}>{children}</View>
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
