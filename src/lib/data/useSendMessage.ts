import { useCallback } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";

import { messagesRef } from "@/lib/firestore/collections";
import {
  WRITE_TIMEOUT_MS,
  writeWithTimeout,
} from "@/lib/firestore/writeWithTimeout";
import type {
  AttachmentType,
  MessageAttachment,
  UserRole,
} from "@/lib/firestore/schema";
import { cleanUpOnFailure } from "@/lib/storage/cleanup";
import { messageAttachmentPath, sanitizeFileName } from "@/lib/storage/paths";
import { removeStorageObject, uploadLocalFile } from "@/lib/storage/upload";
import { mapDataError } from "./dataErrors";

/** A file chosen in the composer, before it is uploaded. */
export interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  type: AttachmentType;
}

/**
 * Send a message on a dossier.
 *
 * The message id is minted up front so attachments can be stored under it before
 * the document exists; the document is written last, and a failure deletes any
 * attachment already uploaded — same contract as dossier submission.
 */
export function useSendMessage(
  dossierId: string,
  companyId: string,
  sender: { id: string; name: string; role: UserRole },
) {
  const { id: senderId, name: senderName, role: senderRole } = sender;

  const send = useCallback(
    async (text: string, files: PickedFile[] = []) => {
      const ref = doc(messagesRef(dossierId));
      try {
        await cleanUpOnFailure(async (track) => {
          const attachments: MessageAttachment[] = [];
          for (const file of files) {
            const path = messageAttachmentPath(
              companyId,
              dossierId,
              ref.id,
              file.name,
            );
            track(path);
            const url = await uploadLocalFile(file.uri, path, file.mimeType);
            attachments.push({
              type: file.type,
              url,
              name: sanitizeFileName(file.name),
              size: file.size,
            });
          }

          // Fail fast rather than let an unreachable Firestore buffer the write
          // and hang the send; compensate undoes it if it commits later.
          await writeWithTimeout(
            () =>
              setDoc(ref, {
                senderId,
                senderName,
                senderRole,
                text: text.trim(),
                attachments,
                createdAt: serverTimestamp(),
              }),
            () => void deleteDoc(ref).catch(() => {}),
            WRITE_TIMEOUT_MS,
          );
        }, removeStorageObject);
      } catch (error) {
        throw new Error(mapDataError((error as { code?: string }).code ?? ""));
      }
    },
    [dossierId, companyId, senderId, senderName, senderRole],
  );

  return { send };
}
