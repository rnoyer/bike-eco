import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScreenLoader } from "@/components/ui/Spinner";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
import { redirectFor, resolveAuthRoute } from "@/lib/auth/routeGuard";
import { useForegroundNotifications } from "@/lib/notifications/useForegroundNotifications";
import { useNotificationRouting } from "@/lib/notifications/useNotificationRouting";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, initializing, session, status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Inside the gate, not around it: a cold-start tap has to wait for the
  // session before it can pick a route group.
  useNotificationRouting();
  useForegroundNotifications();

  useEffect(() => {
    if (loading) return;
    const route = resolveAuthRoute({
      loading,
      role: session?.role ?? null,
      status,
    });
    const target = redirectFor(route, segments);
    if (target) router.replace(target);
  }, [loading, session, status, segments, router]);

  // Splash only until auth first resolves. We intentionally do NOT unmount the
  // navigator on later `loading` flips (a token refresh re-sets loading=true) —
  // unmounting <Stack> resets the router to its initial route (index) and would
  // strand a just-signed-in user there. `initializing` latches false after the
  // first resolution and never flips back.
  if (initializing) return <ScreenLoader />;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <AuthGate>
            {/* Groups own their headers; the root must not draw one per group screen
                (that produced the stacked "(b2b)" / "(tabs)" headers). */}
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
