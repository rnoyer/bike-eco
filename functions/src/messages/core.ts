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
