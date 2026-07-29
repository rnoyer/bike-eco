import Spinner from "@/components/ui/Spinner";
import { tokens } from "@/theme/tokens";
import { Children, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  title: string;
  loading?: boolean;
  /** Mapped French copy from the read hook. Rendered instead of the empty
   *  message, so a denied or offline read never reads as "aucun dossier". */
  error?: string | null;
  emptyMessage?: string;
  children?: ReactNode;
}

/** Owns all four states of a titled list — loading, error, empty, content — so
 *  no screen re-implements them. Precedence: loading → error → empty → list. */
export default function Section({
  title,
  loading,
  error,
  emptyMessage,
  children,
}: Props) {
  const isEmpty = Children.count(children) === 0;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {loading ? (
        <Spinner style={styles.spinner} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
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
  error: { fontSize: 14, color: tokens.colors.danger },
  list: { gap: tokens.space.xl },
});
