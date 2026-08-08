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

  // Computed in render, not in the effect, so the notification hook below can
  // read the same decision the guard is about to act on.
  const target = redirectFor(
    resolveAuthRoute({ loading, role: session?.role ?? null, status }),
    segments,
  );

  // Inside the gate, not around it: a cold-start tap has to wait for the
  // session before it can pick a route group.
  //
  // `target === null` is the guard saying "the viewer is already in the group
  // I would send them to", and it is the only safe moment to replay a parked
  // tap. On a cold start `getInitialNotification` resolves in milliseconds
  // while auth takes hundreds, and when auth lands it exposes `role`/`status`
  // and flips `initializing` in a SINGLE commit — so a push issued in that
  // commit is immediately clobbered by the `router.replace` below, which still
  // sees the pre-push `segments` (`[]`). Gating on the guard's own decision
  // fixes that without making React's effect-ordering a contract.
  useNotificationRouting(target === null);
  useForegroundNotifications();

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

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
