import { getMessaging, onMessage } from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { resolveRoute } from "./notificationRouting";

/**
 * FCM hands a foreground message straight to the app without drawing anything,
 * so the banner has to be presented here or it is simply lost.
 *
 * Suppressed when the user is already looking at what the notification is
 * about — being banner-pinged for the chat thread you are actively reading is
 * the fastest way to get notifications turned off.
 */
export function useForegroundNotifications(): void {
  const pathname = usePathname();
  const { session } = useAuth();
  const role = session?.role ?? null;
  // The listener is registered once; a ref keeps it reading the live route
  // instead of the one captured at subscribe time.
  const current = useRef({ pathname, role });
  useEffect(() => {
    current.current = { pathname, role };
  });

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    return onMessage(getMessaging(), async (message) => {
      const { pathname: here, role: viewer } = current.current;
      const target = viewer ? resolveRoute(message.data, viewer) : null;
      // `usePathname` reports the resolved path without the group segment
      // ("/dossier/dos_1/chat"), while resolveRoute includes it — compare on
      // the suffix rather than for equality.
      if (target && here && target.endsWith(here)) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.notification?.title ?? "",
          body: message.notification?.body ?? "",
          data: message.data ?? {},
        },
        trigger: null,
      });
    });
  }, []);
}
