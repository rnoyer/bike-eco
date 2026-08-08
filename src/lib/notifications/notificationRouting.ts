import type { NotificationTrigger } from "expo-notifications";

import type { UserRole } from "@/lib/firestore/schema";

/**
 * True when the OS delivered this notification straight from FCM, false when
 * this app scheduled it locally (`scheduleNotificationAsync`).
 *
 * `expo-notifications` tags a push-delivered notification's trigger with
 * `type: "push"` (`PushNotificationTrigger`); a locally scheduled one carries a
 * date/interval/channel trigger or `null`, none of which has that type — and
 * `ChannelAwareTriggerInput` has no `type` field at all, hence the `in` guard
 * rather than a plain property read.
 *
 * Two call sites need the distinction, and both would misbehave without it:
 * the foreground handler must not let the OS present a remote message it is
 * about to re-present locally, and the response listener must not route a
 * remote tap that `onNotificationOpenedApp` already owns.
 */
export function isRemoteNotification(
  trigger: NotificationTrigger | null | undefined,
): boolean {
  return !!trigger && "type" in trigger && trigger.type === "push";
}

/**
 * Turn an FCM `data` block into an in-app route.
 *
 * The payload names a *logical* target ("this dossier"), never a route: the
 * same notification is delivered to a b2b user and to the back office, whose
 * dossier screens live in different route groups. Resolving here means the
 * server never has to know which group the recipient belongs to.
 *
 * Every value arrives as a string (FCM data is string-only) from a source
 * outside this process, so each one is validated rather than trusted.
 */
export function resolveRoute(
  data: Record<string, unknown> | undefined,
  role: UserRole,
): string | null {
  if (!data) return null;
  const id = (key: string): string | null => {
    const value = data[key];
    return typeof value === "string" && value !== "" ? value : null;
  };
  const group = role === "backoffice" ? "(backoffice)" : "(b2b)";

  switch (data.kind) {
    case "company": {
      // Only the back office has a companies route.
      const companyId = id("companyId");
      return role === "backoffice" && companyId
        ? `/(backoffice)/companies/${companyId}`
        : null;
    }
    case "dossier": {
      const dossierId = id("dossierId");
      return dossierId ? `/${group}/dossier/${dossierId}` : null;
    }
    case "chat": {
      const dossierId = id("dossierId");
      return dossierId ? `/${group}/dossier/${dossierId}/chat` : null;
    }
    default:
      return null;
  }
}
