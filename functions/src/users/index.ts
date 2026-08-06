import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/https";

import { callerFrom, db, toHttps } from "../callable";
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
        nom: (d.nom as string) ?? "",
        prenom: (d.prenom as string) ?? "",
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
      await db().collection("users").doc(uid).delete();
    },
  };
}

export const setColleagueAdmin = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const input = colleagueAdminSchema.parse(req.data);
    await setColleagueAdminCore(input, callerFrom(req), usersDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const deleteColleague = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const input = colleagueActionSchema.parse(req.data);
    await deleteColleagueCore(input, callerFrom(req), usersDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const deleteMyAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    await deleteMyAccountCore(callerFrom(req), usersDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});
