import { useState } from "react";
import {
  Dimensions,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { clampIndex } from "./imageGallery";
import { ZoomableImage } from "./ZoomableImage";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

/**
 * Full-screen swipeable image viewer. Rendered only while open (the parent mounts
 * it on tap and unmounts it via `onClose`), so its initial page is set once from
 * props with no effect. Horizontal paging is suspended while the current image is
 * zoomed, so a pan moves within the image instead of turning the page.
 */
export default function ImageGalleryModal({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const start = clampIndex(initialIndex, images.length);
  const [page, setPage] = useState(start);
  const [zoomed, setZoomed] = useState(false);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));

  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={!zoomed}
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: start * SCREEN_W, y: 0 }}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {images.map((uri) => (
            <View key={uri} style={styles.page}>
              <ZoomableImage uri={uri} onZoomChange={setZoomed} />
            </View>
          ))}
        </ScrollView>

        <Pressable
          style={styles.close}
          onPress={onClose}
          accessibilityLabel="Fermer"
          hitSlop={12}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>

        {images.length > 1 ? (
          <View style={styles.dots} pointerEvents="none">
            {images.map((uri, i) => (
              <View
                key={uri}
                style={[styles.dot, i === page && styles.dotActive]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  page: { width: SCREEN_W, height: SCREEN_H },
  close: {
    position: "absolute",
    top: 48,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  closeText: { color: "#fff", fontSize: 20, lineHeight: 22 },
  dots: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: { backgroundColor: "#fff" },
});
