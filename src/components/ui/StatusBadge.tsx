import { StyleSheet, Text, View } from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

const LABELS: Record<DossierStatus, string> = {
  a_traiter: "À traiter",
  en_cours: "En cours",
  cloture: "Clôturé",
};

export default function StatusBadge({ status }: { status: DossierStatus }) {
  const palette = tokens.status[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.fg }]}>{LABELS[status]}</Text>
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
