import { StyleSheet, Text, View } from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { STATUS_LABELS } from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";

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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radius.sm,
    alignSelf: "flex-start",
  },
  text: { fontSize: 12, fontWeight: "600" },
});
