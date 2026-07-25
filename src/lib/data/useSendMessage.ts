import { useCallback } from "react";
import { doc } from "firebase/firestore";

import { messagesRef } from "@/lib/firestore/collections";
import type { AttachmentType, MessageAttachment } from "@/lib/firestore/schema";
import { cleanUpOnFailure } from "@/lib/storage/cleanup";
import { messageAttachmentPath, sanitizeFileName } from "@/lib/storage/paths";
import { removeStorageObject, uploadLocalFile } from "@/lib/storage/upload";
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

/**
 * Send a message on a dossier.
 *
 * The message id is minted up front so attachments can be stored under it before
 * the document exists. Attachments upload client-side; the message document is
 * written by the `sendMessage` callable, which server-stamps senderId/senderName/
 * senderRole (the client cannot forge them). A failure deletes any attachment
 * already uploaded.
 */
export function useSendMessage(dossierId: string, companyId: string) {
  const send = useCallback(
    async (text: string, files: PickedFile[] = []) => {
      const messageId = doc(messagesRef(dossierId)).id;
      await cleanUpOnFailure(async (track) => {
        const attachments: MessageAttachment[] = [];
        for (const file of files) {
          const path = messageAttachmentPath(companyId, dossierId, messageId, file.name);
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
    },
    [dossierId, companyId],
  );

  return { send };
}
