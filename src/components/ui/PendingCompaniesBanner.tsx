import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useCompanies } from "@/lib/data/useCompanies";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import { tokens } from "@/theme/tokens";

/** Back-office only. Renders nothing until there is ≥1 pending registration. */
export default function PendingCompaniesBanner({ onPress }: { onPress: () => void }) {
  const { region } = useRegionFilter();
  const pending = useCompanies("pending", region);
  if (pending.data.length === 0) return null;
  return (
    <TouchableOpacity style={styles.banner} activeOpacity={0.85} onPress={onPress}>
      <Text style={styles.bannerText}>{`${pending.data.length} nouveaux vendeurs à valider`}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.primary,
  },
  bannerText: { color: tokens.colors.primaryText, fontSize: 15, fontWeight: "700" },
});
