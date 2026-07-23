import { getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/https";
import { ZodError } from "zod";

import { B2C_EMAIL_SECRETS } from "../email";
import { sendApplicantEmail, sendInviteEmail } from "./emails";
import {
  acceptInviteCore, registerCompanyCore, resolveInviteCore, sendInviteCore,
  RegError, type Deps, type StoredInvitation,
} from "./core";
import {
  acceptInviteSchema, registerCompanySchema, resolveInviteSchema, sendInviteSchema,
} from "./schemas";

const db = () => getFirestore(getApp(), "bike-eco-db");

function realDeps(): Deps {
  return {
    createUser: async (email, password) => (await getAuth().createUser({ email, password })).uid,
    setClaims: (uid, claims) => getAuth().setCustomUserClaims(uid, claims),
    companyExistsForSiret: async (siret) =>
      !(await db().collection("companies").where("siret", "==", siret).limit(1).get()).empty,
    writeCompany: async (id, data) =>
      void (await db().collection("companies").doc(id).set({ ...data, createdAt: FieldValue.serverTimestamp() })),
    writeUser: async (uid, data) =>
      void (await db().collection("users").doc(uid).set({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })),
    newCompanyId: () => db().collection("companies").doc().id,
    findInvitationByHash: async (hash) => {
      const snap = await db().collection("invitations").where("tokenHash", "==", hash).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      const d = doc.data();
      return {
        id: doc.id, email: d.email, companyId: d.companyId, tokenHash: d.tokenHash,
        companyName: (await db().collection("companies").doc(d.companyId).get()).data()?.name ?? "",
        expiresAt: d.expiresAt.toMillis(),
      } satisfies StoredInvitation;
    },
    writeInvitation: async (id, data) =>
      void (await db().collection("invitations").doc(id).set({
        ...data,
        expiresAt: Timestamp.fromMillis(data.expiresAt as number),
        createdAt: FieldValue.serverTimestamp(),
      })),
    deleteInvitation: async (id) => void (await db().collection("invitations").doc(id).delete()),
    now: () => Date.now(),
    sendApplicantEmail,
    sendInviteEmail,
  };
}

function toHttps(err: unknown): never {
  if (err instanceof RegError) throw new HttpsError(err.code, err.message);
  if (err instanceof ZodError) throw new HttpsError("invalid-argument", "Données du formulaire invalides.");
  throw new HttpsError("internal", "Une erreur est survenue. Veuillez réessayer.");
}

export const registerCompany = onCall({ secrets: B2C_EMAIL_SECRETS }, async (req) => {
  try {
    const input = registerCompanySchema.parse(req.data);
    await registerCompanyCore(input, req.auth?.uid ?? null, req.auth?.token.email ?? null, realDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const sendInvite = onCall({ secrets: B2C_EMAIL_SECRETS }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const input = sendInviteSchema.parse(req.data);
    await sendInviteCore(input, {
      uid: req.auth.uid, role: req.auth.token.role as string,
      status: req.auth.token.status as string, companyId: req.auth.token.companyId as string,
    }, realDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const resolveInvite = onCall(async (req) => {
  try {
    const input = resolveInviteSchema.parse(req.data);
    return await resolveInviteCore(input, realDeps());
  } catch (e) { toHttps(e); }
});

export const acceptInvite = onCall(async (req) => {
  try {
    const input = acceptInviteSchema.parse(req.data);
    await acceptInviteCore(input, req.auth?.uid ?? null, req.auth?.token.email ?? null, realDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});
