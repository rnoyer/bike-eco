import { dash } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";
import { StyleSheet, Text, View } from "react-native";

/**
 * The "comments" part of an `InfoCard`: a bold label on its own line, then the
 * free text full-width beneath it.
 *
 * Free-text fields (commentaires, accessoires) get the whole card width instead
 * of competing with a label on one line — a long value in a label/value row
 * squeezes the label and overflows.
 */
export default function InfoComment({
  label,
  text,
}: {
  label: string;
  text: string | null | undefined;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label} :</Text>
      {/* Dashed rather than hidden when empty, like every other absent value —
          it keeps the part's height stable. */}
      <Text style={styles.text}>{dash(text)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: tokens.space.sm },
  label: { fontSize: 14, fontWeight: "700", color: tokens.colors.primary },
  text: { fontSize: 14, lineHeight: 20, color: tokens.colors.primary },
});
