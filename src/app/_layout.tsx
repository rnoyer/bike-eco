import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
import { resolveAuthRoute } from "@/lib/auth/routeGuard";

const PUBLIC_SEGMENTS = new Set(["index", "b2cSubmissionForm"]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, session, status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const route = resolveAuthRoute({ loading, role: session?.role ?? null, status });
    const top = segments[0] ?? "index";
    const inAuthGroup = top === "(auth)";
    const isPublic = PUBLIC_SEGMENTS.has(top);

    if (route === "signin") {
      if (!inAuthGroup && !isPublic) router.replace("/(auth)/signin");
    } else if (route === "pending") {
      router.replace("/(auth)/pending");
    } else if (route === "b2b") {
      if (inAuthGroup) router.replace("/(b2b)/(tabs)/dashboard");
    } else if (route === "backoffice") {
      if (inAuthGroup) router.replace("/(backoffice)/(tabs)/dashboard");
    }
  }, [loading, session, status, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate>
          {/* Groups own their headers; the root must not draw one per group screen
              (that produced the stacked "(b2b)" / "(tabs)" headers). */}
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
