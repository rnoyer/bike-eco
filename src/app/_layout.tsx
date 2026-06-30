import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Groups own their headers; the root must not draw one per group screen
          (that produced the stacked "(b2b)" / "(tabs)" headers). */}
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
