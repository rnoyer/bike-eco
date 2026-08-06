import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/https";

import { db, callerFrom, toHttps } from "../callable";
import { B2C_EMAIL_SECRETS } from "../email";
import { approveCompanyCore, deleteCompanyCore, type BackofficeDeps } from "./backoffice";
import { generateCompanyId } from "./companyId";
import {
  acceptInviteCore,
  registerCompanyCore, resolveInviteCore, sendInviteCore,
  type Deps, type StoredInvitation,
} from "./core";
import { sendApplicantEmail, sendApprovalEmail, sendInviteEmail } from "./emails";
import {
  acceptInviteSchema, companyActionSchema, registerCompanySchema,
  resolveInviteSchema, sendInviteSchema,
} from "./schemas";

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
    newCompanyId: generateCompanyId,
    newDocumentId: () => db().collection("invitations").doc().id,
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
    getUserIsAdmin: async (uid) =>
      (await db().collection("users").doc(uid).get()).data()?.isAdmin === true,
    getCompanyName: async (companyId) =>
      ((await db().collection("companies").doc(companyId).get()).data()?.name as string) ?? "",
    sendInviteEmail,
  };
}

function backofficeDeps(): BackofficeDeps {
  return {
    getCompany: async (id) => {
      const snap = await db().collection("companies").doc(id).get();
      if (!snap.exists) return null;
      const d = snap.data()!;
      return { name: d.name, status: d.status };
    },
    getPendingCompanyUsers: async (companyId) => {
      const snap = await db().collection("users")
        .where("companyId", "==", companyId).where("status", "==", "pending").get();
      return snap.docs.map((doc) => ({ uid: doc.id, email: doc.data().email as string }));
    },
    activateUser: async (uid) => {
      await db().collection("users").doc(uid).update({
        status: "active", updatedAt: FieldValue.serverTimestamp(),
      });
      const existing = (await getAuth().getUser(uid)).customClaims ?? {};
      await getAuth().setCustomUserClaims(uid, { ...existing, status: "active" });
    },
    setCompanyActive: async (id) => {
      await db().collection("companies").doc(id).update({
        status: "active", validatedAt: FieldValue.serverTimestamp(),
      });
    },
    sendApprovalEmail,
    deleteStorage: async (companyId) => {
      await getStorage().bucket().deleteFiles({ prefix: `dossiers/${companyId}/` });
    },
    deleteDossiers: async (companyId) => {
      const snap = await db().collection("dossiers").where("companyId", "==", companyId).get();
      await Promise.all(snap.docs.map((doc) => db().recursiveDelete(doc.ref)));
    },
    deleteUsers: async (companyId) => {
      const snap = await db().collection("users").where("companyId", "==", companyId).get();
      await Promise.all(snap.docs.map(async (doc) => {
        await getAuth().deleteUser(doc.id).catch((err: unknown) => {
          // The Auth user may already be gone; anything else is a real failure.
          if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
        });
        await doc.ref.delete();
      }));
    },
    deleteInvitations: async (companyId) => {
      const snap = await db().collection("invitations").where("companyId", "==", companyId).get();
      await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
    },
    deleteCompany: async (id) => { await db().collection("companies").doc(id).delete(); },
  };
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

export const approveCompany = onCall({ secrets: B2C_EMAIL_SECRETS }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const { companyId } = companyActionSchema.parse(req.data);
    await approveCompanyCore(companyId, callerFrom(req), backofficeDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const deleteCompany = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const { companyId } = companyActionSchema.parse(req.data);
    await deleteCompanyCore(companyId, callerFrom(req), backofficeDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});
