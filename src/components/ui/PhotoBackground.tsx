import type { ReactNode } from "react";
import { ImageBackground, StyleSheet, View } from "react-native";

/**
 * Full-screen motorbike photo with a dark overlay, shared by the landing and
 * auth screens so their backdrop stays in sync. Children render on top of the
 * overlay and own their own layout (centered card, scroll view, …).
 */
export default function PhotoBackground({ children }: { children: ReactNode }) {
  return (
    <ImageBackground
      source={require("@/assets/images/bg-motos.jpg")}
      style={styles.background}
      resizeMode="cover"
    >
      {/* Darkens the photo so foreground content stays legible. */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: { backgroundColor: "rgba(0, 0, 0, 0.5)" },
});
