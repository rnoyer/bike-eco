import {
  getInitialNotification,
  getMessaging,
  onNotificationOpenedApp,
  type RemoteMessage,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { isRemoteNotification, resolveRoute } from "./notificationRouting";

/**
 * Navigate when the user taps a notification.
 *
 * Three entry points, all required: `onNotificationOpenedApp` for a tap while
 * the app is backgrounded, `getInitialNotification` for the cold start (where
 * the tap is what launched the process and there is no listener yet), and
 * expo's response listener for a tap on the *foreground* banner — that banner
 * is a local notification scheduled by `useForegroundNotifications`, never
 * delivered through FCM's tray, so neither RNFB entry point fires for it.
 *
 * A cold-start tap resolves before the session does. Navigating then would be
 * undone by AuthGate's redirect to sign-in, so the payload is parked and
 * replayed once the session is active *and* the guard has settled — see
 * `guardSettled`.
 *
 * Parked in *state*, not a ref: a ref write does not re-render, so a tap
 * arriving while the session is already active would sit there and never be
 * consumed by the effect below.
 *
 * @param guardSettled AuthGate's own "the viewer is already where I would send
 * them" signal. Auth resolving exposes `role`/`status` and drops the splash in
 * ONE commit; a push made in that commit is overwritten by the guard's
 * `router.replace`, which still sees the pre-push `segments`. Waiting for the
 * guard's decision to be `null` is what makes the drain land on the target
 * instead of the dashboard — and it does not make React's effect ordering a
 * load-bearing contract the way reshuffling the hooks would.
 */
export function useNotificationRouting(guardSettled: boolean): void {
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
    const offOpened = onNotificationOpenedApp(messagingInstance, handle);

    // The foreground banner's tap. Remote taps are filtered out because on iOS
    // expo's UNUserNotificationCenter delegate sees them too, and routing the
    // same payload from both here and `onNotificationOpenedApp` would park it
    // twice and push the screen twice.
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const { trigger, content } = response.notification.request;
        if (isRemoteNotification(trigger)) return;
        setPending(content.data ?? {});
      },
    );

    return () => {
      offOpened();
      responseSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!guardSettled || !pending || !role || status !== "active") return;
    const route = resolveRoute(pending, role);
    // Cleared whether or not it resolved: an unroutable payload must not be
    // retried on every session change for the rest of the process. This is a
    // one-shot queue drain (guarded, terminal, does not loop), not the
    // cascading-render pattern the rule is meant to catch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPending(null);
    if (route) router.push(route as Href);
  }, [guardSettled, pending, role, status, router]);
}
