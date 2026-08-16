import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScreenLoader } from "@/components/ui/Spinner";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
import { redirectFor, resolveAuthRoute } from "@/lib/auth/routeGuard";
import { useForegroundNotifications } from "@/lib/notifications/useForegroundNotifications";
import { useNotificationRouting } from "@/lib/notifications/useNotificationRouting";
import { tokens } from "@/theme/tokens";

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

/** Web only: a desktop browser is far wider than any screen this UI was drawn
 *  for, so the whole app — headers and tab bar included, which is why this sits
 *  above the navigator rather than inside a screen — is capped at
 *  `tokens.layout.maxContentWidth` and centred. The page behind it is
 *  `primary`, so the excess reads as the app's own frame instead of dead white.
 *  On native it is a passthrough: no wrapper view, no extra layout pass. */
function WebFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  return (
    <View style={styles.webPage}>
      <View style={styles.webColumn}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  webPage: { flex: 1, backgroundColor: tokens.colors.primary },
  webColumn: {
    flex: 1,
    width: "100%",
    maxWidth: tokens.layout.maxContentWidth,
    alignSelf: "center",
    overflow: "hidden",
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <WebFrame>
            <AuthGate>
              {/* Groups own their headers; the root must not draw one per group screen
                  (that produced the stacked "(b2b)" / "(tabs)" headers). */}
              <Stack screenOptions={{ headerShown: false }} />
            </AuthGate>
          </WebFrame>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
