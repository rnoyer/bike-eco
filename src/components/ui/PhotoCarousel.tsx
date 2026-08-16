import { Image } from "expo-image";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  type LayoutChangeEvent,
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

/** Photo box: 4:3, i.e. height = 0.75 × width. */
const RATIO = 4 / 3;

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
  // A page is as wide as the carousel, which is not the window: on web the app
  // is a centred column narrower than the browser, and on native a rotation
  // changes it. Measured, therefore — a module-level `Dimensions.get("window")`
  // is read once at import and was wrong in both cases.
  const [width, setWidth] = useState(0);
  // Normalized once, so the carousel, the dots' keys and the full-screen viewer
  // all agree on the same uri.
  const uris = photos.map((uri) => storageUrl(uri));
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width > 0) setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  function measure(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
  }

  return (
    <View style={styles.wrap} onLayout={measure}>
      {width > 0 ? (
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
                style={{ width, height: width / RATIO }}
                contentFit="cover"
                transition={150}
              />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
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
  wrap: {
    width: "100%",
    aspectRatio: RATIO,
    backgroundColor: tokens.colors.divider,
  },
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
