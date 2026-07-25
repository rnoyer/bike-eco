import type { MessageAttachment } from "@/lib/firestore/schema";
import { call } from "./callable";

export interface SendMessagePayload {
  dossierId: string;
  messageId: string;
  text: string;
  attachments: MessageAttachment[];
}

export const callSendMessage = (p: SendMessagePayload) =>
  call<SendMessagePayload, { ok: true }>("sendMessage", p).then(() => undefined);
