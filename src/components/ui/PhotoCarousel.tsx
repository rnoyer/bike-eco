import { Image } from "expo-image";
import type { ReactNode } from "react";
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
import { storageUrl } from "@/lib/storage/displayUrl";
import { tokens } from "@/theme/tokens";
import ImageViewerModal from "./ImageViewerModal";
import StatusBadge from "./StatusBadge";

const W = Dimensions.get("window").width;

export default function PhotoCarousel({
  photos,
  status,
  topLeft,
}: {
  photos: string[];
  status?: DossierStatus;
  /** Overlaid opposite the status badge. Used for the subscription toggle. */
  topLeft?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  // Normalized once, so the carousel, the dots' keys and the full-screen viewer
  // all agree on the same uri.
  const uris = photos.map((uri) => storageUrl(uri));
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
        {uris.map((uri) => (
          <Pressable key={uri} onPress={() => setViewerUri(uri)}>
            <Image
              source={{ uri }}
              style={styles.photo}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        ))}
      </ScrollView>
      {topLeft ? <View style={styles.topLeft}>{topLeft}</View> : null}
      {status ? (
        <View style={styles.badge}>
          <StatusBadge status={status} />
        </View>
      ) : null}
      <View style={styles.dots} pointerEvents="none">
        {uris.map((uri, i) => (
          <View key={uri} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      {viewerUri !== null ? (
        <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: W * 0.75, backgroundColor: tokens.colors.divider },
  photo: { width: W, height: W * 0.75 },
  badge: { position: "absolute", top: tokens.space.md, right: tokens.space.md },
  topLeft: { position: "absolute", top: tokens.space.md, left: tokens.space.md },
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
  // Sits on a photo, so it stays white — not the app canvas.
  dotActive: { backgroundColor: tokens.colors.surface },
});
