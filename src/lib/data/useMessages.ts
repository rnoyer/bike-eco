import { useEffect, useState } from "react";
import {
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
} from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { messagesRef, type WithId } from "@/lib/firestore/collections";
import type { Message } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/**
 * Live chat thread for a dossier, oldest first.
 *
 * Carries the document id (`WithId`) because the delivered id is the evidence a
 * send succeeded: `useSendMessage` drops its optimistic placeholder when the id
 * it minted shows up here. Without it a send whose *response* was lost would
 * leave a "failed" bubble sitting next to the delivered message.
 */
export function useMessages(dossierId: string) {
  const { session } = useAuth();
  const [resolved, setResolved] = useState<{
    key: string;
    data: WithId<Message>[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!session || !dossierId) return;
    return onSnapshot(
      query(messagesRef(dossierId), orderBy("createdAt")),
      (snap) =>
        setResolved({
          key: dossierId,
          data: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
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
