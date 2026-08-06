import { storageUrl } from "@/lib/storage/displayUrl";
import { tokens } from "@/theme/tokens";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface Props {
  thumbnailUrl: string | null;
  title: string;
  subtitle?: string;
  onPress: () => void;
}

export default function DossierCard({
  thumbnailUrl,
  title,
  subtitle,
  onPress,
}: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={thumbnailUrl ? { uri: storageUrl(thumbnailUrl) } : undefined}
        style={styles.thumb}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
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
    // Tinted rather than grey, so a dossier with no photo still reads as ours
    // instead of as a hole in the card.
    backgroundColor: tokens.colors.brandTint,
  },
  body: { flex: 1, gap: tokens.space.xs },
  title: { fontSize: 15, fontWeight: "600", color: tokens.colors.primary },
  subtitle: { fontSize: 13, color: tokens.colors.muted },
});
