import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getPushPermission,
  registerPushToken,
  type PushPermission,
} from "./pushRegistration";

/**
 * Register this device once the user is signed in and active.
 *
 * Mounted from the dashboards rather than the root layout so the OS prompt
 * lands on a screen that explains itself — and never in front of the sign-in
 * form, where iOS's one-shot prompt would be spent on a stranger.
 */
export function usePushRegistration(): void {
  const { session, status } = useAuth();
  const uid = session?.id ?? null;

  useEffect(() => {
    if (!uid || status !== "active") return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void registerPushToken(uid).then((off) => {
      if (cancelled) off();
      else unsubscribe = off;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid, status]);
}

/** The current OS permission, for the Settings row. */
export function usePushPermission(): { status: PushPermission | "loading" } {
  const [status, setStatus] = useState<PushPermission | "loading">("loading");
  useEffect(() => {
    let active = true;
    void getPushPermission().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, []);
  return { status };
}
