import { StyleSheet, Text, View } from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

const MAP: Record<DossierStatus, { label: string; bg: string; fg: string }> = {
  a_traiter: { label: "À traiter", bg: "#FEF3C7", fg: "#92400E" },
  en_cours: { label: "En cours", bg: "#DBEAFE", fg: "#1E40AF" },
  cloture: { label: "Clôturé", bg: "#DCFCE7", fg: "#166534" },
};

export default function StatusBadge({ status }: { status: DossierStatus }) {
  const s = MAP[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
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
