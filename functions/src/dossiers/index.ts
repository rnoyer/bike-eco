import { getStorage } from "firebase-admin/storage";

import { authedCall, db } from "../callable";
import { RegError } from "../errors";
import { deleteDossierCore, type DossierDeleteDeps } from "./core";
import { deleteDossierSchema } from "./schemas";

function dossierDeleteDeps(): DossierDeleteDeps {
  return {
    getDossier: async (id) => {
      const snap = await db().collection("dossiers").doc(id).get();
      if (!snap.exists) return null;
      const companyId = snap.data()?.companyId;
      // The cast boundary: Firestore data is untyped, and a document with no
      // usable companyId would build the prefix "dossiers/undefined/..." — a
      // delete that silently matches nothing while the document goes away.
      if (typeof companyId !== "string" || companyId === "") {
        throw new RegError("failed-precondition", "Ce dossier est incomplet et ne peut pas être supprimé.");
      }
      return { companyId };
    },
    // One prefixed delete covers all three shapes `src/lib/storage/paths.ts`
    // writes under a dossier: `photos/{index}.{ext}`, `photos/thumb.jpg`, and
    // `messages/{messageId}/{fileName}`. No enumeration needed.
    deleteStorage: async (companyId, dossierId) => {
      await getStorage().bucket().deleteFiles({
        prefix: `dossiers/${companyId}/${dossierId}/`,
      });
    },
    // Recursive, not a plain delete: a plain `.delete()` on a document leaves
    // its subcollections behind as orphaned data. This sweeps `messages` and
    // `mutes` with it.
    deleteDossier: async (id) => {
      await db().recursiveDelete(db().collection("dossiers").doc(id));
    },
  };
}

/** Permanently delete one dossier, its conversations and its documents. */
export const deleteDossier = authedCall(
  deleteDossierSchema,
  (input, caller) => deleteDossierCore(input, caller, dossierDeleteDeps()),
);
