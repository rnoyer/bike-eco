import { dash } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";
import { StyleSheet, Text, View } from "react-native";

/** A label and its already-formatted value. Units belong in the value
 *  (`"48000 km"`, `"2400 €"`) — see `lib/ui/format`. */
export type InfoRow = [label: string, value: string];

/**
 * The "liste d'information" part of an `InfoCard`: bold label, then the value
 * flowing directly after it.
 *
 * The value is *not* right-aligned with a flexible spacer. Left flow lets a
 * long value wrap under itself instead of squeezing the label off-screen —
 * which is what the previous `@expo/ui` lists did.
 */
export default function InfoRows({ rows }: { rows: InfoRow[] }) {
  return (
    <View style={styles.list}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label} :</Text>
          <Text style={styles.value}>{dash(value)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: tokens.space.sm },
  row: { flexDirection: "row", gap: tokens.space.sm },
  label: { fontSize: 14, fontWeight: "700", color: tokens.colors.primary },
  // `flexShrink` is what makes the value wrap inside the row rather than
  // pushing the label out of the card.
  value: { fontSize: 14, color: tokens.colors.primary, flexShrink: 1 },
});
