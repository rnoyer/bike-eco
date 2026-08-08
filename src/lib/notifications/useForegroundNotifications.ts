import { getMessaging, onMessage } from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { isRemoteNotification, resolveRoute } from "./notificationRouting";

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
      // This handler governs REMOTE notifications too, not just the local copy
      // scheduled below. Our FCM payload carries both a `notification` and a
      // `data` block (`functions/src/notifications/send.ts`), so on iOS the
      // push also reaches expo-notifications' UNUserNotificationCenter
      // delegate: answering `shouldShowBanner: true` for it would have the OS
      // present the push AND leave the local copy to present a second banner.
      // Worse, the "don't ping me for the thread I'm reading" check below only
      // guards the local copy, so the OS banner would defeat the one
      // foreground behaviour this feature specifies. Suppress the remote
      // presentation; keep the local one, which is the one that can be
      // suppressed intelligently.
      //
      // Android never takes the `isRemote` branch — expo's
      // `ExpoFirebaseMessagingService` declares `android:priority="-1"` for
      // the `MESSAGING_EVENT` intent filter versus RNFB's default, so RNFB
      // wins the service race and expo-notifications never sees the remote
      // message at all. Noting it because a platform-conditional-looking check
      // with no `Platform.OS` reads as arbitrary otherwise: this makes iOS
      // behave the way Android already does, it does not change Android.
      handleNotification: async (notification) => {
        const isRemote = isRemoteNotification(notification.request.trigger);
        return {
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: !isRemote,
          shouldShowList: !isRemote,
        };
      },
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
