import { onSnapshot, type FirestoreError } from "firebase/firestore";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { userDoc, type WithId } from "@/lib/firestore/collections";
import type { AppUser } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/** Live single user profile. Stays loading for an empty uid (route params
 *  resolve late), exactly like `useDossier`. */
export function useUser(uid: string) {
  const { session } = useAuth();
  const [resolved, setResolved] = useState<{
    key: string;
    data: WithId<AppUser> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!session || !uid) return;
    return onSnapshot(
      userDoc(uid),
      (snap) =>
        setResolved({
          key: uid,
          data: snap.exists() ? { ...snap.data(), id: snap.id } : null,
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key: uid, data: null, error: mapDataError(err.code) }),
    );
  }, [session, uid]);

  const loading = !uid || resolved?.key !== uid;
  return {
    data: loading ? null : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}
