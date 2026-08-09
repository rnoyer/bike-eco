import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { authedCall, db, NO_PAYLOAD } from "../callable";
import {
  deleteColleagueCore, deleteMyAccountCore, setColleagueAdminCore,
  type Scope, type UsersDeps,
} from "./core";
import { colleagueActionSchema, colleagueAdminSchema } from "./schemas";

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
