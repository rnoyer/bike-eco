import { useEffect, useState } from "react";
import { onSnapshot, type FirestoreError } from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { dossierDoc, type WithId } from "@/lib/firestore/collections";
import type { Dossier } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/** Live single dossier. Stays loading for an empty id (route params resolve late). */
export function useDossier(id: string) {
  const { session } = useAuth();
  const [resolved, setResolved] = useState<{
    key: string;
    data: WithId<Dossier> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!session || !id) return;
    return onSnapshot(
      dossierDoc(id),
      (snap) =>
        setResolved({
          key: id,
          data: snap.exists() ? { ...snap.data(), id: snap.id } : null,
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key: id, data: null, error: mapDataError(err.code) }),
    );
  }, [session, id]);

  // Guard the empty-id case: `undefined !== undefined` is false, which would
  // otherwise mark a missing id as "loaded" and dereference the null state.
  const loading = !id || resolved?.key !== id;

  return {
    data: loading ? null : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}
