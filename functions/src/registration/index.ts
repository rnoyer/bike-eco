import { getAuth } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { authedCall, db, publicCall } from "../callable";
import { B2C_EMAIL_SECRETS } from "../email";
import { approveCompanyCore, deleteCompanyCore, type BackofficeDeps } from "./backoffice";
import { generateCompanyId } from "./companyId";
import {
  acceptInviteCore,
  registerCompanyCore, resolveInviteCore, sendInviteCore,
  type Deps, type InviteRole, type StoredInvitation,
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
      // `doc.data()` is `any`, so a malformed/missing `role` would otherwise
      // flow straight into setCustomUserClaims as a role-less account. Fail
      // closed: an unrecognised role is treated as "no such invitation".
      const role: InviteRole | null =
        d.role === "backoffice" ? "backoffice" : d.role === "b2b" ? "b2b" : null;
      if (!role) return null;
      // A back-office invitation has no company — skip the lookup entirely
      // rather than issuing a `doc(null)` read.
      const companyId = (d.companyId as string | null) ?? null;
      return {
        id: doc.id, email: d.email, role, companyId, tokenHash: d.tokenHash,
        companyName: companyId
          ? ((await db().collection("companies").doc(companyId).get()).data()?.name as string) ?? ""
          : null,
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
        // Recursive, for the `pushTokens` subcollection: a plain delete leaves
        // the device tokens behind as personal data outliving the account.
        await db().recursiveDelete(doc.ref);
      }));
    },
    deleteInvitations: async (companyId) => {
      const snap = await db().collection("invitations").where("companyId", "==", companyId).get();
      await Promise.all(snap.docs.map((doc) => doc.ref.delete()));
    },
    deleteCompany: async (id) => { await db().collection("companies").doc(id).delete(); },
  };
}

const EMAIL_SENDING = { secrets: B2C_EMAIL_SECRETS };

export const registerCompany = publicCall(
  registerCompanySchema,
  (input, who) => registerCompanyCore(input, who.uid, who.email, realDeps()),
  EMAIL_SENDING,
);

export const sendInvite = authedCall(
  sendInviteSchema,
  (input, caller) => sendInviteCore(input, caller, realDeps()),
  EMAIL_SENDING,
);

export const resolveInvite = publicCall(resolveInviteSchema, (input) =>
  resolveInviteCore(input, realDeps()),
);

export const acceptInvite = publicCall(acceptInviteSchema, (input, who) =>
  acceptInviteCore(input, who.uid, who.email, realDeps()),
);

export const approveCompany = authedCall(
  companyActionSchema,
  ({ companyId }, caller) =>
    approveCompanyCore(companyId, caller, backofficeDeps()),
  EMAIL_SENDING,
);

export const deleteCompany = authedCall(
  companyActionSchema,
  ({ companyId }, caller) =>
    deleteCompanyCore(companyId, caller, backofficeDeps()),
);
