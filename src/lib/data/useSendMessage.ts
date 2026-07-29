import { useCallback, useMemo, useRef, useState } from "react";
import { doc } from "firebase/firestore";

import { messagesRef, type WithId } from "@/lib/firestore/collections";
import type {
  AttachmentType,
  Message,
  MessageAttachment,
} from "@/lib/firestore/schema";
import { cleanUpOnFailure } from "@/lib/storage/cleanup";
import { messageAttachmentPath, sanitizeFileName } from "@/lib/storage/paths";
import { removeStorageObject, uploadLocalFile } from "@/lib/storage/upload";
import { frenchMessage } from "@/lib/ui/useAsyncAction";
import { callSendMessage } from "./messages";
import { mapDataError } from "./dataErrors";

/** A file chosen in the composer, before it is uploaded. */
export interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  type: AttachmentType;
}

/** A message the user has sent that is not yet confirmed in the live thread. */
export interface PendingMessage {
  /** The Firestore document id, minted before the first attempt. Retrying
   *  re-uses it, which is what makes retry safe to offer. */
  id: string;
  text: string;
  files: PickedFile[];
  status: "sending" | "failed";
  /** Mapped French copy, shown under the bubble when `status === "failed"`. */
  error: string | null;
}

/** One attempt: upload every attachment, then write the document. */
async function deliver(
  dossierId: string,
  companyId: string,
  messageId: string,
  text: string,
  files: PickedFile[],
): Promise<void> {
  await cleanUpOnFailure(async (track) => {
    const attachments: MessageAttachment[] = [];
    for (const file of files) {
      const path = messageAttachmentPath(
        companyId,
        dossierId,
        messageId,
        file.name,
      );
      track(path);
      let url: string;
      try {
        url = await uploadLocalFile(file.uri, path, file.mimeType);
      } catch (error) {
        throw new Error(mapDataError((error as { code?: string }).code ?? ""));
      }
      attachments.push({
        type: file.type,
        url,
        name: sanitizeFileName(file.name),
        size: file.size,
      });
    }
    // The callable throws a ready French Error on failure; cleanUpOnFailure
    // removes any uploaded attachments before it propagates.
    await callSendMessage({ dossierId, messageId, text: text.trim(), attachments });
  }, removeStorageObject);
}

/**
 * Send a message on a dossier, optimistically.
 *
 * The message id is minted up front so attachments can be stored under it
 * before the document exists. Attachments upload client-side; the message
 * document is written by the `sendMessage` callable, which server-stamps
 * senderId/senderName/senderRole (the client cannot forge them).
 *
 * The send is *not* fire-and-forget. It used to be, and the composer cleared
 * the user's text and attachments the moment they tapped Envoyer, so a failure
 * alerted them after their input was already gone. Now the content lives in a
 * `pending` entry — rendered as a greyed bubble — until it is confirmed, or
 * until the user retries or discards it. A failure loses nothing.
 *
 * `delivered` closes the loop. Retry re-sends under the original id and the
 * callable writes with `create()`, which rejects an id that already exists — so
 * a send whose *response* was lost (document written, client saw an error)
 * could never be retried successfully. Matching the minted id against the ids
 * the live thread reports is the only reliable evidence the write landed.
 */
export function useSendMessage(
  dossierId: string,
  companyId: string,
  delivered: WithId<Message>[],
) {
  const [entries, setEntries] = useState<PendingMessage[]>([]);

  // Ids currently being delivered. The rendered `status` cannot serve as the
  // guard: two taps on Réessayer in the same tick both read the *same* rendered
  // message, still marked "failed". Two concurrent attempts would upload the
  // attachments twice and let the loser's `cleanUpOnFailure` delete the
  // winner's files.
  const inFlight = useRef(new Set<string>());

  const attempt = useCallback(
    async (message: PendingMessage) => {
      if (inFlight.current.has(message.id)) return;
      inFlight.current.add(message.id);
      try {
        await deliver(
          dossierId,
          companyId,
          message.id,
          message.text,
          message.files,
        );
        // Deliberately not removed here: the delivered document is what
        // resolves it (see the derivation below), so the bubble never blinks
        // out and back in, and a lost response still resolves correctly.
      } catch (error) {
        setEntries((current) =>
          current.map((m) =>
            m.id === message.id
              ? { ...m, status: "failed", error: frenchMessage(error) }
              : m,
          ),
        );
      } finally {
        inFlight.current.delete(message.id);
      }
    },
    [dossierId, companyId],
  );

  const send = useCallback(
    (text: string, files: PickedFile[] = []) => {
      const message: PendingMessage = {
        id: doc(messagesRef(dossierId)).id,
        text,
        files,
        status: "sending",
        error: null,
      };
      setEntries((current) => [...current, message]);
      void attempt(message);
    },
    [dossierId, attempt],
  );

  /** Takes the message rather than its id so the state updater stays pure —
   *  kicking off the retry from inside one would fire it twice under Strict
   *  Mode's double invocation. */
  const retry = useCallback(
    (message: PendingMessage) => {
      if (message.status !== "failed") return;
      setEntries((current) =>
        current.map((m) =>
          m.id === message.id
            ? { ...m, status: "sending" as const, error: null }
            : m,
        ),
      );
      void attempt(message);
    },
    [attempt],
  );

  const discard = useCallback(
    (id: string) => setEntries((current) => current.filter((m) => m.id !== id)),
    [],
  );

  // Reconciliation is a derivation, not an effect: any entry whose id the live
  // thread reports is done, whatever this client thinks happened to it.
  // Resolved entries stay in `entries` — a handful of strings each, and the
  // array dies with the screen — but they are never rendered again.
  const deliveredKey = delivered.map((m) => m.id).join(",");
  const deliveredIds = useMemo(
    () => new Set(delivered.map((m) => m.id)),
    // `delivered` is a fresh array each render; its ids are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deliveredKey],
  );
  const pending = useMemo(
    () => entries.filter((m) => !deliveredIds.has(m.id)),
    [entries, deliveredIds],
  );

  return { send, pending, retry, discard };
}
