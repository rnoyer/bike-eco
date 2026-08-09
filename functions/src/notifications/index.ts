import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/firestore";
import * as logger from "firebase-functions/logger";

import { db } from "../callable";
import { motoLabel } from "./copy";
import { resolveDeliveries, type NotificationEvent, type Recipient, type ResolveDeps } from "./core";
import type { DossierStatus, Region, UserRole } from "./labels";
import { dispatch } from "./send";

/**
 * App data lives in the named `bike-eco-db`, NOT `(default)`. A trigger
 * declared without `database` binds to the default database and silently never
 * fires — there is no error to notice.
 *
 * `retry: false` on all four: a notification has no compensating action, and a
 * duplicate push is worse than a missed one.
 */
const TRIGGER = { database: "bike-eco-db", retry: false } as const;

function toRecipient(uid: string, data: FirebaseFirestore.DocumentData): Recipient {
  return {
    uid,
    role: data.role as UserRole,
    notificationRegion: (data.notificationRegion as Region | null | undefined) ?? null,
  };
}

function resolveDeps(): ResolveDeps {
  return {
    // Equality-only filters, so Firestore serves this from single-field
    // indexes. If it ever answers `failed-precondition` asking for a composite
    // index, add it to firestore.indexes.json.
    backofficeUsers: async () => {
      const snap = await db()
        .collection("users")
        .where("role", "==", "backoffice")
        .where("status", "==", "active")
        .get();
      return snap.docs.map((d) => toRecipient(d.id, d.data()));
    },
    companyMembers: async (companyId) => {
      const snap = await db()
        .collection("users")
        .where("companyId", "==", companyId)
        .where("status", "==", "active")
        .get();
      return snap.docs.map((d) => toRecipient(d.id, d.data()));
    },
    mutedUids: async (dossierId) => {
      const snap = await db()
        .collection("dossiers").doc(dossierId)
        .collection("mutes")
        .get();
      return snap.docs.map((d) => d.id);
    },
  };
}

/** Resolve + send, logging rather than throwing: `retry: false` means a throw
 *  buys nothing, and a notification must never look like a failed write. */
async function emit(event: NotificationEvent): Promise<void> {
  try {
    await dispatch(await resolveDeliveries(event, resolveDeps()));
  } catch (e) {
    logger.error("Notification fan-out failed", { kind: event.kind, error: String(e) });
  }
}

export const onCompanyCreated = onDocumentCreated(
  { ...TRIGGER, document: "companies/{companyId}" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await emit({
      kind: "companyRegistered",
      companyId: event.params.companyId,
      companyName: (data.name as string) ?? "",
      createdByName: (data.createdByName as string) ?? "",
      region: data.region as Region,
    });
  },
);

export const onDossierCreated = onDocumentCreated(
  { ...TRIGGER, document: "dossiers/{dossierId}" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const submitter = (data.submitter ?? {}) as { prenom?: string; nom?: string; companyName?: string };
    await emit({
      kind: "dossierCreated",
      dossierId: event.params.dossierId,
      region: data.region as Region,
      companyName: submitter.companyName ?? "",
      sellerName: `${submitter.prenom ?? ""} ${submitter.nom ?? ""}`.trim(),
    });
  },
);

export const onDossierMessageCreated = onDocumentCreated(
  { ...TRIGGER, document: "dossiers/{dossierId}/messages/{messageId}" },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;
    const dossierSnap = await db().collection("dossiers").doc(event.params.dossierId).get();
    const dossier = dossierSnap.data();
    if (!dossier) return;
    await emit({
      kind: "messageCreated",
      dossierId: event.params.dossierId,
      region: dossier.region as Region,
      companyId: dossier.companyId as string,
      senderUid: message.senderId as string,
      senderRole: message.senderRole as UserRole,
      senderName: (message.senderName as string) ?? "",
      moto: motoLabel((dossier.vehicle ?? {}) as { marque?: string; modele?: string }),
    });
  },
);

/**
 * Status and prix validé are two distinct notifications in the spec, so a
 * single management submit that changes both sends both.
 */
export const onDossierUpdated = onDocumentUpdated(
  { ...TRIGGER, document: "dossiers/{dossierId}" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const shared = {
      dossierId: event.params.dossierId,
      region: after.region as Region,
      companyId: after.companyId as string,
      actorUid: (after.updatedBy as string) ?? "",
      moto: motoLabel((after.vehicle ?? {}) as { marque?: string; modele?: string }),
    };

    if (before.status !== after.status) {
      // Both ends of the transition: `resolveDeliveries` needs them to work out
      // which roles the change is actually visible to (a_traiter <-> en_cours is
      // invisible to b2b).
      await emit({
        kind: "statusChanged",
        ...shared,
        previousStatus: before.status as DossierStatus,
        status: after.status as DossierStatus,
      });
    }
    if (before.validatedPrice !== after.validatedPrice) {
      await emit({
        kind: "priceChanged",
        ...shared,
        validatedPrice: (after.validatedPrice as number | null) ?? null,
      });
    }
  },
);
