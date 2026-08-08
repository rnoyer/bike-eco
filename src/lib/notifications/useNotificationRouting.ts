import {
  getInitialNotification,
  getMessaging,
  onNotificationOpenedApp,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { resolveRoute } from "./notificationRouting";

/**
 * Navigate when the user taps a notification.
 *
 * Two entry points, both required: `onNotificationOpenedApp` for a tap while
 * the app is backgrounded, and `getInitialNotification` for the cold start,
 * where the tap is what launched the process and there is no listener yet.
 *
 * A cold-start tap resolves before the session does. Navigating then would be
 * undone by AuthGate's redirect to sign-in, so the payload is parked and
 * replayed once the session is active.
 *
 * Parked in *state*, not a ref: a ref write does not re-render, so a tap
 * arriving while the session is already active would sit there and never be
 * consumed by the effect below.
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  const { session, status } = useAuth();
  const role = session?.role ?? null;
  const [pending, setPending] = useState<Record<string, unknown> | null>(
    null,
  );

  useEffect(() => {
    const messagingInstance = getMessaging();
    const handle = (message: RemoteMessage | null) => {
      if (message?.data) setPending(message.data);
    };
    void getInitialNotification(messagingInstance).then(handle);
    return onNotificationOpenedApp(messagingInstance, handle);
  }, []);

  useEffect(() => {
    if (!pending || !role || status !== "active") return;
    const route = resolveRoute(pending, role);
    // Cleared whether or not it resolved: an unroutable payload must not be
    // retried on every session change for the rest of the process. This is a
    // one-shot queue drain (guarded, terminal, does not loop), not the
    // cascading-render pattern the rule is meant to catch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(null);
    if (route) router.push(route as Href);
  }, [pending, role, status, router]);
}
