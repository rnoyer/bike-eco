import { orderBy, query } from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { messagesRef } from "@/lib/firestore/collections";
import type { Message } from "@/lib/firestore/schema";
import { useLiveQuery } from "./useLive";

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
  return useLiveQuery<Message>(session && dossierId ? dossierId : "", () =>
    query(messagesRef(dossierId), orderBy("createdAt")),
  );
}
