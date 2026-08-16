import { Image } from "expo-image";
import { type LayoutChangeEvent, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const MAX_SCALE = 4;

/**
 * A full-screen image with pinch-, double-tap-, and pan-when-zoomed gestures. Pan
 * is bounded so the image can't be flung off-screen, and the scale is capped.
 *
 * The animated transform is applied to an `Animated.View` wrapping a plain
 * `expo-image` — expo-image is not an Animated component, so the style must sit on
 * the wrapper, not the image.
 */
export function ZoomableImage({ uri }: { uri: string }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  // The pan bounds are relative to the box the image is drawn in, which is not
  // the window: on web the viewer is capped at the app's column width. Shared
  // values because the gesture reads them on the UI thread.
  const boxWidth = useSharedValue(0);
  const boxHeight = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(MAX_SCALE, Math.max(1, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value === 1) {
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        const maxX = ((scale.value - 1) * boxWidth.value) / 2;
        const maxY = ((scale.value - 1) * boxHeight.value) / 2;
        translateX.value = Math.min(
          maxX,
          Math.max(-maxX, savedTranslateX.value + e.translationX),
        );
        translateY.value = Math.min(
          maxY,
          Math.max(-maxY, savedTranslateY.value + e.translationY),
        );
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const composed = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  function measure(e: LayoutChangeEvent) {
    boxWidth.value = e.nativeEvent.layout.width;
    boxHeight.value = e.nativeEvent.layout.height;
  }

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.container} onLayout={measure}>
        <Animated.View style={[styles.imageWrap, animatedStyle]}>
          <Image source={{ uri }} style={styles.image} contentFit="contain" />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
    justifyContent: "center",
  },
  imageWrap: { flex: 1, width: "100%" },
  image: { flex: 1, width: "100%", height: "100%" },
});
