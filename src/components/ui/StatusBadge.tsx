import type { DossierStatus } from "@/lib/firestore/schema";
import { STATUS_LABELS } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";
import { StyleSheet, Text, View } from "react-native";

export default function StatusBadge({ status }: { status: DossierStatus }) {
  const palette = tokens.status[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.sm,
    alignSelf: "flex-start",
  },
  text: { fontSize: 16, fontWeight: "600" },
});
