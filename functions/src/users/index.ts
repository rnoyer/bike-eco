import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { authedCall, db, NO_PAYLOAD } from "../callable";
import {
  chunk, deleteColleagueCore, deleteMyAccountCore, setColleagueAdminCore,
  updateMyProfileCore, type ProfilePatch, type Scope, type UsersDeps,
} from "./core";
import {
  colleagueActionSchema, colleagueAdminSchema, updateMyProfileSchema,
} from "./schemas";

/** Firestore caps a write batch at 500 operations; one dossier is one update. */
const BATCH_LIMIT = 400;

/** `{ nom }` → `{ "submitter.nom": … }` — dotted paths so the other submitter
 *  fields (email, companyName) survive the merge. */
function submitterPatch(patch: ProfilePatch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(patch).map(([field, value]) => [`submitter.${field}`, value]),
  );
}

function usersDeps(): UsersDeps {
  return {
    getUser: async (uid) => {
      const snap = await db().collection("users").doc(uid).get();
      if (!snap.exists) return null;
      const d = snap.data()!;
      return {
        uid: snap.id,
        role: d.role as string,
        companyId: (d.companyId as string | null) ?? null,
        isAdmin: d.isAdmin === true,
        nom: (d.nom as string) ?? "",
        prenom: (d.prenom as string) ?? "",
        telephone: (d.telephone as string) ?? "",
      };
    },
    // Counted in memory rather than with a two-equality-filter query: teams are
    // small, and this needs no index at all.
    countAdmins: async (scope: Scope) => {
      const q = scope.kind === "backoffice"
        ? db().collection("users").where("role", "==", "backoffice")
        : db().collection("users").where("companyId", "==", scope.companyId);
      const snap = await q.get();
      return snap.docs.filter((doc) => doc.data().isAdmin === true).length;
    },
    setAdmin: async (uid, isAdmin) => {
      await db().collection("users").doc(uid).update({
        isAdmin, updatedAt: FieldValue.serverTimestamp(),
      });
    },
    deleteAuthUser: async (uid) => {
      await getAuth().deleteUser(uid).catch((err: unknown) => {
        // Already gone is the outcome we wanted; anything else is a real failure.
        if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
      });
    },
    deleteUserDoc: async (uid) => {
      // `recursiveDelete`, not `delete()`: a plain document delete leaves
      // subcollections behind, and `users/{uid}/pushTokens` would survive the
      // account as personal data (the device token) that no product path can
      // ever reach again.
      await db().recursiveDelete(db().collection("users").doc(uid));
    },
    updateProfile: async (uid, patch) => {
      await db().collection("users").doc(uid).update({
        ...patch, updatedAt: FieldValue.serverTimestamp(),
      });
    },
    propagateToDossiers: async (uid, patch) => {
      // `select()` with no fields fetches ids only — this reads every dossier
      // the user ever filed and needs none of their content.
      const snap = await db().collection("dossiers")
        .where("submittedBy", "==", uid).select().get();
      const fields = submitterPatch(patch);
      // `updatedAt` is deliberately left alone: correcting your own name is not
      // a change *to the dossier*, and `updatedBy` even less so — the
      // notification trigger reads it to decide whom to skip. (That trigger
      // only emits on a `status` / `validatedPrice` change, so these writes
      // fire it and send nothing.)
      for (const docs of chunk(snap.docs, BATCH_LIMIT)) {
        const batch = db().batch();
        for (const doc of docs) batch.update(doc.ref, fields);
        await batch.commit();
      }
    },
    getCompanyCreator: async (companyId) => {
      const snap = await db().collection("companies").doc(companyId).get();
      return snap.exists ? ((snap.data()!.createdBy as string) ?? null) : null;
    },
    setCompanyCreatedByName: async (companyId, createdByName) => {
      await db().collection("companies").doc(companyId).update({ createdByName });
    },
  };
}

export const setColleagueAdmin = authedCall(
  colleagueAdminSchema,
  (input, caller) => setColleagueAdminCore(input, caller, usersDeps()),
);

export const deleteColleague = authedCall(
  colleagueActionSchema,
  (input, caller) => deleteColleagueCore(input, caller, usersDeps()),
);

export const deleteMyAccount = authedCall(NO_PAYLOAD, (_input, caller) =>
  deleteMyAccountCore(caller, usersDeps()),
);

export const updateMyProfile = authedCall(updateMyProfileSchema, (input, caller) =>
  updateMyProfileCore(input, caller, usersDeps()),
);
