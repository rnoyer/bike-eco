import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import StatusBadge from "./StatusBadge";

interface Props {
  thumbnailUrl: string | null;
  title: string;
  subtitle: string;
  status?: DossierStatus;
  onPress: () => void;
}

export default function DossierCard({
  thumbnailUrl,
  title,
  subtitle,
  status,
  onPress,
}: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
        style={styles.thumb}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {status ? <StatusBadge status={status} /> : null}
      </View>
    </TouchableOpacity>
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
  thumb: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.divider,
  },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: "600", color: tokens.colors.primary },
  subtitle: { fontSize: 13, color: tokens.colors.muted },
});
