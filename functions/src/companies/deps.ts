import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

import { db } from "../callable";
import type { CompanyCascadeDeps } from "./cascade";

/** The admin-SDK implementation of {@link CompanyCascadeDeps}, shared by the
 *  back office's `deleteCompany` and by `deleteMyAccount`'s last-member branch. */
export function companyCascadeDeps(): CompanyCascadeDeps {
  return {
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
