import Spinner from "@/components/ui/Spinner";
import { tokens } from "@/theme/tokens";
import { Children, Fragment, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  /** Rendered in the dark title bar. */
  title: string;
  loading?: boolean;
  /** Mapped French copy from the read hook, shown in place of the content. */
  error?: string | null;
  /** Shown, muted, when the card has no parts. Omit for cards whose content is
   *  always present. */
  emptyMessage?: string;
  /** One or more parts — `InfoRows`, `InfoContactRow`, `InfoComment`. */
  children?: ReactNode;
}

/**
 * The read-only information card: a dark title bar over a white body whose
 * parts are separated by hairline dividers.
 *
 * It replaces `Section` for label/value blocks — the title bar *is* the title,
 * so a card is never nested in a `Section` of the same name. `Section` stays
 * for button groups and lists of cards.
 */
export default function InfoCard({
  title,
  loading,
  error,
  emptyMessage,
  children,
}: Props) {
  // Drop conditionally-absent parts before the dividers are computed, so a
  // `{x ? <Part/> : null}` child never leaves a doubled line behind.
  const parts = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{title}</Text>
      </View>
      {/* Same precedence as `Section`: loading → error → empty → content.
          `error` outranks `emptyMessage` on purpose — a denied or offline read
          must not read as "there is nothing here". */}
      {loading ? (
        <Spinner style={styles.state} />
      ) : error ? (
        <Text style={[styles.state, styles.error]}>{error}</Text>
      ) : parts.length === 0 && emptyMessage ? (
        <Text style={[styles.state, styles.empty]}>{emptyMessage}</Text>
      ) : (
        parts.map((part, i) => (
          // Parts are positional and never reordered, so the index is a stable
          // key here. They don't draw their own separator: the card owns it,
          // which lets any part be first, last or only without a conditional.
          <Fragment key={i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            <View style={styles.part}>{part}</View>
          </Fragment>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    // Clips the title bar's square corners to the card's radius.
    overflow: "hidden",
  },
  header: {
    backgroundColor: tokens.colors.primary,
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm + tokens.space.xs,
  },
  headerText: {
    color: tokens.colors.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
  part: { padding: tokens.space.md },
  divider: { height: 1, backgroundColor: tokens.colors.divider },
  state: { padding: tokens.space.md },
  error: { fontSize: 14, color: tokens.colors.danger },
  empty: { fontSize: 14, color: tokens.colors.muted },
});
