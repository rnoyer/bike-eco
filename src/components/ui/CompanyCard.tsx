import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  subtitle: string;
  onManage: () => void;
}

export default function CompanyCard({ title, subtitle, onManage }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      <TouchableOpacity style={styles.manage} onPress={onManage} activeOpacity={0.7}>
        <Text style={styles.manageText}>Gérer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.md,
    padding: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
  },
  body: { flex: 1, gap: tokens.space.xs },
  title: { fontSize: 15, fontWeight: "600", color: tokens.colors.primary },
  subtitle: { fontSize: 13, color: tokens.colors.muted },
  manage: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.primary,
  },
  manageText: { color: tokens.colors.primaryText, fontSize: 14, fontWeight: "600" },
});
