import {
  collection,
  doc,
  type DocumentData,
  type FirestoreDataConverter,
  type QueryDocumentSnapshot,
} from "firebase/firestore";

import { db } from "../../../firebaseConfig";
import type {
  AppUser,
  Company,
  Dossier,
  Invitation,
  Message,
} from "./schema";

/** A Firestore document paired with its id (docs don't carry their own id). */
export type WithId<T> = T & { id: string };

export const COLLECTIONS = {
  companies: "companies",
  users: "users",
  invitations: "invitations",
  dossiers: "dossiers",
  messages: "messages",
} as const;

/** Identity converter that types reads/writes as T without transforming data. */
function typed<T extends DocumentData>(): FirestoreDataConverter<T> {
  return {
    toFirestore: (data) => data as DocumentData,
    // `estimate` so a pending `serverTimestamp()` reads back as an estimated
    // local Timestamp instead of null: the just-written dossier/message arrives
    // through the live listener before the server resolves its timestamp, and
    // consumers call `.toMillis()`/`.toDate()` on `createdAt` (dashboard sort,
    // ChatThread) which would throw on null.
    fromFirestore: (snap: QueryDocumentSnapshot) =>
      snap.data({ serverTimestamps: "estimate" }) as T,
  };
}

// ─── top-level collections ───────────────────────────────────────────────────

export const companiesRef = collection(db, COLLECTIONS.companies).withConverter(
  typed<Company>(),
);
export const usersRef = collection(db, COLLECTIONS.users).withConverter(
  typed<AppUser>(),
);
export const invitationsRef = collection(
  db,
  COLLECTIONS.invitations,
).withConverter(typed<Invitation>());
export const dossiersRef = collection(db, COLLECTIONS.dossiers).withConverter(
  typed<Dossier>(),
);

// ─── document helpers ────────────────────────────────────────────────────────

export const companyDoc = (companyId: string) =>
  doc(companiesRef, companyId);
export const userDoc = (uid: string) => doc(usersRef, uid);
export const invitationDoc = (invitationId: string) =>
  doc(invitationsRef, invitationId);
export const dossierDoc = (dossierId: string) => doc(dossiersRef, dossierId);

// ─── messages subcollection ──────────────────────────────────────────────────

export const messagesRef = (dossierId: string) =>
  collection(dossierDoc(dossierId), COLLECTIONS.messages).withConverter(
    typed<Message>(),
  );

export const messageDoc = (dossierId: string, messageId: string) =>
  doc(messagesRef(dossierId), messageId);
