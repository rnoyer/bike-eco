import { StyleSheet, Text, View } from "react-native";

import penLineIcon from "@/assets/images/icons/pen-line.svg";
import IconButton from "@/components/ui/IconButton";
import { dash } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";

/**
 * The "information modifiable" part of an `InfoCard`: a label/value row whose
 * value is followed by a right-aligned pencil button opening the field's edit
 * form.
 *
 * Visually it is the same species as `InfoContactRow` and `InfoCollapsibleRow`
 * collapsed — a label/value row with one right-hand action. The hairlines above
 * and below are the *card's*: this part draws none, so each editable row must
 * be its own child of the `InfoCard`, not a row inside an `InfoRows`.
 *
 * It carries no state and does no writing. The row knows the value it shows and
 * nothing about where the edit goes.
 */
export default function InfoEditableRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string | null | undefined;
  onPress: () => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label} :</Text>
      <Text style={styles.value}>{dash(value)}</Text>
      <IconButton
        icon={penLineIcon}
        // An icon-only button is unreachable by a screen reader without this,
        // and the label has to say which row it edits.
        accessibilityLabel={`Modifier : ${label}`}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Mirrors `InfoContactRow`'s row exactly — same species, same shape.
  row: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  label: { fontSize: 14, fontWeight: "700", color: tokens.colors.primary },
  // Takes the slack so the button sits on the right edge, and wraps rather than
  // pushing the button out of the card.
  value: { fontSize: 14, color: tokens.colors.primary, flex: 1 },
});
