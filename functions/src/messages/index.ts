import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/https";

import { callerFrom, db, toHttps } from "../callable";
import { sendMessageCore, type SendMessageDeps } from "./core";
import { sendMessageSchema } from "./schemas";

function messageDeps(): SendMessageDeps {
  return {
    getDossier: async (id) => {
      const snap = await db().collection("dossiers").doc(id).get();
      if (!snap.exists) return null;
      return { companyId: snap.data()!.companyId as string };
    },
    getUser: async (uid) => {
      const snap = await db().collection("users").doc(uid).get();
      if (!snap.exists) return null;
      const d = snap.data()!;
      return { prenom: d.prenom as string, nom: d.nom as string };
    },
    getCompanyName: async (companyId) => {
      const snap = await db().collection("companies").doc(companyId).get();
      return snap.exists ? (snap.data()!.name as string) : null;
    },
    // .create() fails if the doc already exists — a replayed messageId cannot
    // clobber an existing message.
    createMessage: async (dossierId, messageId, data) => {
      await db()
        .collection("dossiers").doc(dossierId)
        .collection("messages").doc(messageId)
        .create({ ...data, createdAt: FieldValue.serverTimestamp() });
    },
  };
}

export const sendMessage = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const input = sendMessageSchema.parse(req.data);
    await sendMessageCore(input, callerFrom(req), messageDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});
