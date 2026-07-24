import { RegError, type CallerClaims } from "../registration/core";
import type { SendMessageInput } from "./schemas";

export interface MessageAttachment {
  type: "image" | "pdf";
  url: string;
  name: string;
  size: number;
}

export interface NewMessage {
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  attachments: MessageAttachment[];
}

export interface SendMessageDeps {
  getDossier(id: string): Promise<{ companyId: string } | null>;
  getUser(uid: string): Promise<{ prenom: string; nom: string } | null>;
  getCompanyName(companyId: string): Promise<string | null>;
  createMessage(dossierId: string, messageId: string, data: NewMessage): Promise<void>;
}

/**
 * True when a Firebase Storage *download URL* points into this dossier's own
 * message folder. Attachment urls come from `getDownloadURL`, which percent-
 * encodes the object path into the `/o/` segment; companyId/dossierId/messageId
 * are alphanumeric Firestore auto-ids, so only the `/` separators are encoded
 * (as `%2F`). Matching the encoded prefix blocks a crafted url that references
 * another company's, dossier's, or message's Storage object.
 */
export function isAttachmentUnderMessagePrefix(
  url: string,
  companyId: string,
  dossierId: string,
  messageId: string,
): boolean {
  const prefix = `dossiers%2F${companyId}%2F${dossierId}%2Fmessages%2F${messageId}%2F`;
  return url.includes(prefix);
}

export async function sendMessageCore(
  input: SendMessageInput,
  caller: CallerClaims,
  deps: SendMessageDeps,
): Promise<void> {
  if (caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée aux comptes actifs.");
  }
  const dossier = await deps.getDossier(input.dossierId);
  if (!dossier) throw new RegError("not-found", "Dossier introuvable.");

  const isBackoffice = caller.role === "backoffice";
  const isOwningDealer = caller.role === "b2b" && caller.companyId === dossier.companyId;
  if (!isBackoffice && !isOwningDealer) {
    throw new RegError("permission-denied", "Action non autorisée sur ce dossier.");
  }

  for (const a of input.attachments) {
    if (!isAttachmentUnderMessagePrefix(a.url, dossier.companyId, input.dossierId, input.messageId)) {
      throw new RegError("invalid-argument", "Pièce jointe invalide.");
    }
  }

  const user = await deps.getUser(caller.uid);
  if (!user) throw new RegError("not-found", "Utilisateur introuvable.");
  const person = `${user.prenom} ${user.nom}`.trim();

  let senderName: string;
  if (isBackoffice) {
    senderName = `${person} - Bike-eco`;
  } else {
    const companyName = await deps.getCompanyName(caller.companyId!);
    if (!companyName) throw new RegError("not-found", "Entreprise introuvable.");
    senderName = `${person} - ${companyName}`;
  }

  await deps.createMessage(input.dossierId, input.messageId, {
    senderId: caller.uid,
    senderName,
    senderRole: caller.role!,
    text: input.text.trim(),
    attachments: input.attachments,
  });
}
