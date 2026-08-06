import { tokens } from "@/theme/tokens";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  title: string;
  subtitle: string;
  /** Right-hand button. Omit both to render a card with no action at all. */
  actionLabel?: string;
  onAction?: () => void;
}

/** The thin wide card used by every list of entities (companies, colleagues):
 *  title, subtitle, and an optional right-hand button. */
export default function EntityCard({
  title,
  subtitle,
  actionLabel,
  onAction,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <View style={styles.side}>
          <TouchableOpacity
            style={styles.action}
            onPress={onAction}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
  },
  body: { flex: 1, gap: tokens.space.xs, padding: tokens.space.md },
  side: {
    flexDirection: "row",
    alignItems: "stretch",
    padding: tokens.space.sm,
  },
  title: { fontSize: 15, fontWeight: "600", color: tokens.colors.primary },
  subtitle: { fontSize: 13, color: tokens.colors.muted },
  action: {
    justifyContent: "center",
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.primary,
  },
  actionText: {
    color: tokens.colors.primaryText,
    fontSize: 14,
    fontWeight: "600",
  },
});
