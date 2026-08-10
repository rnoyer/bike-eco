import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
// No default `Animated` import here: the `Animated.View` lives inside
// `IconButton`. This file only produces the style that drives it.
import {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import chevronRightIcon from "@/assets/images/icons/chevron-right.svg";
import IconButton from "@/components/ui/IconButton";
import InfoRows, { type InfoRow } from "@/components/ui/InfoRows";
import { dash } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";

/** How long the chevron takes to swing between its two positions. */
const ROTATION_MS = 150;

/**
 * The "collapsible" part of an `InfoCard`: a label/value row that reveals more
 * `InfoRows` beneath it when tapped.
 *
 * Collapsed, it is deliberately identical to `InfoContactRow` — the two are the
 * same visual species, a label/value row with one right-hand action. The
 * hairlines above and below are the *card's*; this part draws none.
 *
 * `rows` is the switch: pass `null` and the row renders with no button and
 * nothing to expand. That keeps the domain rule ("there is only detail when the
 * answer was oui") at the call site next to the fields it is about, instead of
 * buried in here.
 */
export default function InfoCollapsibleRow({
  label,
  value,
  rows,
}: {
  label: string;
  value: string | null | undefined;
  rows?: InfoRow[] | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const rotation = useSharedValue(0);

  // Rotates the glyph only. Rotating the button would swing its `radius.sm`
  // corners through the transition, which reads as a bug.
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const collapsible = !!rows && rows.length > 0;

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    rotation.value = withTiming(next ? 90 : 0, { duration: ROTATION_MS });
  };

  return (
    <View style={styles.block}>
      <View style={styles.header}>
        <Text style={styles.label}>{label} :</Text>
        <Text style={styles.value}>{dash(value)}</Text>
        {collapsible ? (
          <IconButton
            icon={chevronRightIcon}
            // An icon-only button is unreachable by a screen reader without
            // this, and the label has to say which row it opens.
            accessibilityLabel={`${expanded ? "Masquer" : "Afficher"} le détail : ${label}`}
            expanded={expanded}
            iconStyle={chevronStyle}
            onPress={toggle}
          />
        ) : null}
      </View>
      {/* Mount/unmount, not an animated height: the list is short and
          variable-length, so animating it buys jank rather than clarity. */}
      {collapsible && expanded ? (
        <View style={styles.detail}>
          <InfoRows rows={rows} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: tokens.space.sm },
  // Mirrors `InfoContactRow`'s row exactly — same species, same shape.
  header: { flexDirection: "row", alignItems: "center", gap: tokens.space.sm },
  label: { fontSize: 14, fontWeight: "700", color: tokens.colors.primary },
  // Takes the slack so the button sits on the right edge, and wraps rather than
  // pushing the button out of the card.
  value: { fontSize: 14, color: tokens.colors.primary, flex: 1 },
  // Inset so the sub-rows read as children of the header, not peers of it.
  detail: { paddingLeft: tokens.space.md },
});
