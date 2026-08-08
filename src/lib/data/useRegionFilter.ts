import { updateDoc } from "firebase/firestore";
import { useCallback, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { userDoc } from "@/lib/firestore/collections";
import type { Region } from "@/lib/firestore/schema";

/**
 * The back-office member's "région gérée".
 *
 * Backed by `users/{uid}.notificationRegion`, not device storage: the server
 * fans notifications out by this value, so a device-local preference would let
 * a member watch NORTH on screen while being paged about SOUTH. The session
 * (AuthProvider) is the read path — it already holds the `users/{uid}` document
 * — and the write is a plain `updateDoc` the owner-update rule already allows.
 *
 * The pick is held in local state as well as written, because the session only
 * refreshes on sign-in and `refreshSession()`. Without the override the
 * dropdown would snap back to the old value the moment the component
 * re-rendered. The override is cleared whenever the session catches up.
 */
export function useRegionFilter() {
  const { session, loading } = useAuth();
  const persisted = session?.notificationRegion ?? null;
  // `undefined` = no local pick outstanding. `null` is a real value here
  // ("Toute la France"), so it cannot double as the empty case.
  const [pending, setPending] = useState<Region | null | undefined>(undefined);

  // The session has caught up with the pick — stop overriding, so a change made
  // on another device is no longer masked by this one's stale choice.
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
    // Consumers whose query is région-scoped must hold their loading state
    // until the session resolves, or their first render answers a
    // "Toute la France" query and visibly re-queries.
    ready: !loading,
  };
}
