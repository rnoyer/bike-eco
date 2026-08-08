import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getPushPermission,
  registerPushToken,
  subscribeToPushPermission,
  type PushPermission,
} from "./pushRegistration";

/**
 * Register this device once the user is signed in and active.
 *
 * Mounted from the dashboards rather than the root layout so the OS prompt
 * lands on a screen that explains itself — and never in front of the sign-in
 * form, where iOS's one-shot prompt would be spent on a stranger.
 *
 * A single mount-time attempt is not enough. The permission can be granted
 * from *outside* the app — the Settings row sends the user into the OS
 * precisely to do that — and nothing here would ever re-run, so the user does
 * exactly what the app asked and still receives nothing. Hence the retry on
 * return to the foreground.
 *
 * Two guards keep that retry from being write spam or prompt spam:
 *
 *  - it stops for good once a registration succeeded (`unsubscribe !== null`),
 *    so the steady state costs nothing at all — the overwhelmingly common
 *    foreground is a no-op before it touches anything;
 *  - it re-reads the permission first and only retries on `"granted"`, so it
 *    never re-opens the OS prompt for an `undetermined` permission the user
 *    dismissed. Prompting is the mount path's job and happens once.
 */
export function usePushRegistration(): void {
  const { session, status } = useAuth();
  const uid = session?.id ?? null;

  useEffect(() => {
    if (!uid || status !== "active") return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const attempt = () => {
      void registerPushToken(uid).then((off) => {
        if (!off) return;
        // The effect may have been torn down while this was in flight; tearing
        // the fresh listener straight back down is the only correct answer.
        if (cancelled) off();
        else unsubscribe = off;
      });
    };
    attempt();

    const subscription = AppState.addEventListener("change", (next) => {
      if (next !== "active" || cancelled || unsubscribe) return;
      void getPushPermission().then((permission) => {
        if (!cancelled && !unsubscribe && permission === "granted") attempt();
      });
    });

    return () => {
      cancelled = true;
      subscription.remove();
      unsubscribe?.();
    };
  }, [uid, status]);
}

/**
 * The current OS permission, for the Settings row.
 *
 * Reads on mount, then follows the value: `subscribeToPushPermission` catches a
 * change made by another mounted screen (the Dashboard's prompt), and the
 * foreground re-read catches one made in the OS settings. A mount-only read
 * gets both of the common cases wrong —
 *
 *  - Settings and Dashboard are sibling NativeTabs that mount together.
 *    Settings reads "undetermined", the Dashboard prompts, the user taps
 *    Refuser — and the "Ouvrir les réglages" row stays hidden until an app
 *    restart, even though that prompt is the most common way to reach the
 *    denied state at all.
 *  - The user follows the row into the OS, enables notifications and comes
 *    back: a stale "denied" leaves the row on screen forever.
 *
 * The same cross-tab staleness `useRegionFilter` fixed with a live snapshot;
 * the OS has no snapshot, so it takes a publisher plus a foreground poll.
 * Re-reading an unchanged value settles the same string into state, which
 * React treats as a no-op — the extra reads cost one native call and no
 * render.
 */
export function usePushPermission(): { status: PushPermission | "loading" } {
  const [status, setStatus] = useState<PushPermission | "loading">("loading");
  useEffect(() => {
    let active = true;
    // Subscribe before the first read: `getPushPermission` reports its answer
    // by publishing it, so the subscription is also what delivers that read.
    const unsubscribe = subscribeToPushPermission((permission) => {
      if (active) setStatus(permission);
    });
    void getPushPermission();
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void getPushPermission();
    });
    return () => {
      active = false;
      unsubscribe();
      subscription.remove();
    };
  }, []);
  return { status };
}
