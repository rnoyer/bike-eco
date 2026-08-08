import { updateDoc } from "firebase/firestore";
import { useCallback, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { userDoc } from "@/lib/firestore/collections";
import type { Region } from "@/lib/firestore/schema";
import { useUser } from "./useUser";

/**
 * The back-office member's "région gérée".
 *
 * Backed by `users/{uid}.notificationRegion`, not device storage: the server
 * fans notifications out by this value, so a device-local preference would let
 * a member watch NORTH on screen while being paged about SOUTH. The write is a
 * plain `updateDoc` the owner-update rule already allows.
 *
 * The read path is `useUser`'s live `onSnapshot`, not the AuthProvider
 * session — the session is a snapshot taken at sign-in that only refreshes on
 * sign-in/out or an explicit `refreshSession()`, neither of which happens
 * after a `setRegion` call. The back-office Settings picker and the dashboard
 * render in sibling NativeTabs that stay mounted together, so a session-backed
 * read would let the dashboard keep querying the old région after Settings
 * changed it — exactly the single-source-of-truth requirement the previous
 * module-level kv-store version existed to satisfy. The live listener gives
 * every mounted consumer (this device's sibling tabs, and any other device)
 * the same document, so they all observe the same change without any
 * shared/global state or manual invalidation.
 *
 * The pick is held in local state as well as written, because a Firestore
 * write only reaches this hook after the write commits and the listener's
 * snapshot round-trips. Without the override the dropdown would sit on the
 * old value for that round-trip. The override is cleared whenever the
 * snapshot catches up.
 */
export function useRegionFilter() {
  const { session, loading: sessionLoading } = useAuth();
  const { data: profile, loading: profileLoading } = useUser(
    session?.id ?? "",
  );
  const persisted = profile?.notificationRegion ?? null;
  // `undefined` = no local pick outstanding. `null` is a real value here
  // ("Toute la France"), so it cannot double as the empty case.
  const [pending, setPending] = useState<Region | null | undefined>(undefined);

  // The live snapshot has caught up with the pick — stop overriding, so a
  // change made on another device (or another sibling tab) is no longer
  // masked by this one's stale choice.
  if (pending !== undefined && pending === persisted) setPending(undefined);

  const setRegion = useCallback(
    (r: Region | null) => {
      if (!session) return;
      setPending(r);
      // Fire-and-forget: the dropdown has already moved, and a failed write is
      // a preference that did not stick — not an error worth a modal.
      void updateDoc(userDoc(session.id), { notificationRegion: r }).catch(
        console.error,
      );
    },
    [session],
  );

  return {
    region: pending !== undefined ? pending : persisted,
    setRegion,
    // `useUser` never resolves `loading` for an empty uid (there's nothing to
    // listen to), so once the session itself is settled, a signed-out visitor
    // must not stay stuck waiting on a profile that will never arrive — only
    // gate on the profile listener when there is a session to read one for.
    ready: !sessionLoading && (!session || !profileLoading),
  };
}
