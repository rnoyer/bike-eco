import { Modal, Pressable, StyleSheet, Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ZoomableImage } from "./ZoomableImage";

/**
 * Full-screen viewer for a single image, with pinch/double-tap zoom and a close
 * button. Rendered only while open — the parent mounts it on tap and unmounts it
 * via `onClose` — so it holds no state of its own.
 *
 * The content is wrapped in its OWN `GestureHandlerRootView`: a React Native
 * `Modal` renders into a separate native view hierarchy, so the one at the app root
 * does not cover it and gesture-handler gestures (pinch/double-tap) inside would
 * never be recognized. Required by gesture-handler — do not remove.
 */
export default function ImageViewerModal({
  uri,
  onClose,
}: {
  uri: string;
  onClose: () => void;
}) {
  return (
    <Modal
      visible
      transparent={false}
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.root}>
        <ZoomableImage uri={uri} />

        <Pressable
          style={styles.close}
          onPress={onClose}
          accessibilityLabel="Fermer"
          hitSlop={12}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
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
});
