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

// Hosts that can serve a legitimate attachment download URL: the production
// Firebase Storage host, plus loopback for the local Storage emulator (dev).
// An arbitrary external host is rejected, so a message cannot carry a link to
// content outside our own Storage.
const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "localhost",
  "127.0.0.1",
  "10.0.2.2",
]);

/**
 * True when a Firebase Storage *download URL* points into this dossier's own
 * message folder. Download URLs have the shape
 * `https://<host>/v0/b/<bucket>/o/<percent-encoded-path>?alt=media&token=...`.
 * We parse the URL, require a known Storage host, and match the encoded object
 * path taken from `URL.pathname` — which excludes the query string, so a prefix
 * smuggled into `?...` cannot match. companyId/dossierId/messageId are
 * alphanumeric Firestore auto-ids, so only the `/` separators are encoded (`%2F`).
 */
export function isAttachmentUnderMessagePrefix(
  url: string,
  companyId: string,
  dossierId: string,
  messageId: string,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (!STORAGE_HOSTS.has(parsed.hostname)) return false;
  const marker = "/o/";
  const at = parsed.pathname.indexOf(marker);
  if (at === -1) return false;
  const objectPath = parsed.pathname.slice(at + marker.length);
  const prefix = `dossiers%2F${companyId}%2F${dossierId}%2Fmessages%2F${messageId}%2F`;
  return objectPath.startsWith(prefix);
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
