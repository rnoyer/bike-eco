import { RegError, type CallerClaims } from "../errors";
import { parseStorageDownloadUrl } from "../storageUrl";
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
 * True when a Firebase Storage download URL points into this dossier's own
 * message folder. `parseStorageDownloadUrl` does the parsing and the
 * known-host check; what is left is the prefix. companyId/dossierId/messageId are
 * alphanumeric Firestore auto-ids, so only the `/` separators are encoded
 * (`%2F`). An arbitrary external host is rejected, so a message cannot carry a
 * link to content outside our own Storage.
 */
export function isAttachmentUnderMessagePrefix(
  url: string,
  companyId: string,
  dossierId: string,
  messageId: string,
): boolean {
  const object = parseStorageDownloadUrl(url);
  if (object === null) return false;
  const prefix = `dossiers%2F${companyId}%2F${dossierId}%2Fmessages%2F${messageId}%2F`;
  return object.path.startsWith(prefix);
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
