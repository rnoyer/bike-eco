import { Image } from "expo-image";
import { useState } from "react";
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import ImageGalleryModal from "./ImageGalleryModal";
import StatusBadge from "./StatusBadge";

const W = Dimensions.get("window").width;

export default function PhotoCarousel({
  photos,
  status,
}: {
  photos: string[];
  status?: DossierStatus;
}) {
  const [index, setIndex] = useState(0);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / W));

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {photos.map((uri, i) => (
          <Pressable key={uri} onPress={() => setGalleryIndex(i)}>
            <Image
              source={{ uri }}
              style={styles.photo}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        ))}
      </ScrollView>
      {status ? (
        <View style={styles.badge}>
          <StatusBadge status={status} />
        </View>
      ) : null}
      <View style={styles.dots} pointerEvents="none">
        {photos.map((uri, i) => (
          <View key={uri} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {galleryIndex !== null ? (
        <ImageGalleryModal
          images={photos}
          initialIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: W * 0.75, backgroundColor: tokens.colors.divider },
  photo: { width: W, height: W * 0.75 },
  badge: { position: "absolute", top: tokens.space.md, right: tokens.space.md },
  dots: {
    position: "absolute",
    bottom: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: { backgroundColor: tokens.colors.bg },
});
