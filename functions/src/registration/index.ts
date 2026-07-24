import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { ZodError } from "zod";

// Point the admin SDK at the local emulators in dev. Deployed Gen2 functions
// always run with NODE_ENV="production", so this block is skipped in prod — do
// NOT weaken that guard, or a deploy would target 127.0.0.1 and fail every
// registration. The `??=` also respects the hosts the emulator injects itself,
// so these hardcoded fallbacks only matter when nothing else set them.
if (process.env.NODE_ENV !== "production") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
}

import { B2C_EMAIL_SECRETS } from "../email";
import { approveCompanyCore, deleteCompanyCore, type BackofficeDeps } from "./backoffice";
import {
  acceptInviteCore,
  RegError,
  registerCompanyCore, resolveInviteCore, sendInviteCore,
  type CallerClaims, type Deps, type StoredInvitation,
} from "./core";
import { sendApplicantEmail, sendApprovalEmail, sendInviteEmail } from "./emails";
import {
  acceptInviteSchema, companyActionSchema, registerCompanySchema,
  resolveInviteSchema, sendInviteSchema,
} from "./schemas";

// Guard against a double-init: an unguarded initializeApp() throws
// "app already exists" at cold start, which would take down every function in
// this module (including sendB2cSubmission), not just registration.
if (!getApps().length) initializeApp();

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

function callerFrom(req: { auth?: { uid: string; token: Record<string, unknown> } }): CallerClaims {
  const token = req.auth!.token;
  return {
    uid: req.auth!.uid,
    role: token.role as string,
    status: token.status as string,
    companyId: (token.companyId as string) ?? null,
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
        await getAuth().deleteUser(doc.id).catch(() => undefined); // Auth user may already be gone
        await doc.ref.delete();
      }));
    },
    deleteCompany: async (id) => { await db().collection("companies").doc(id).delete(); },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toHttps(err: unknown): never {
  if (err instanceof RegError) throw new HttpsError(err.code, err.message);
  if (err instanceof ZodError) throw new HttpsError("invalid-argument", "Données du formulaire invalides.");

  if (isRecord(err) && typeof err.code === "string") {
    const code = err.code as string;
    if (code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Cette adresse email est déjà utilisée.");
    }
    if (code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Le mot de passe est invalide.");
    }
  }

  // Unexpected error: log the real cause server-side for debugging, but return a
  // generic French message. An HttpsError's message is propagated to the client
  // for every code (including "internal"), so throwing the raw string here would
  // leak internal detail AND defeat the client's `functions/internal` mapping.
  const message = err instanceof Error ? err.message : String(err);
  logger.error("Registration callable failed", { error: message });
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
