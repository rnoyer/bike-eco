import { useEffect, useState } from "react";
import {
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
} from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { messagesRef } from "@/lib/firestore/collections";
import type { Message } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/** Live chat thread for a dossier, oldest first. */
export function useMessages(dossierId: string) {
  const { session } = useAuth();
  const [resolved, setResolved] = useState<{
    key: string;
    data: Message[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!session || !dossierId) return;
    return onSnapshot(
      query(messagesRef(dossierId), orderBy("createdAt")),
      (snap) =>
        setResolved({
          key: dossierId,
          data: snap.docs.map((d) => d.data()),
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key: dossierId, data: [], error: mapDataError(err.code) }),
    );
  }, [session, dossierId]);

  const loading = !dossierId || resolved?.key !== dossierId;

  return {
    data: loading ? [] : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}
