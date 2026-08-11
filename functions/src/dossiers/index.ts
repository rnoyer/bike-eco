import { getStorage } from "firebase-admin/storage";

import { authedCall, db } from "../callable";
import { deleteDossierCore, type DossierDeleteDeps } from "./core";
import { deleteDossierSchema } from "./schemas";

function dossierDeleteDeps(): DossierDeleteDeps {
  return {
    getDossier: async (id) => {
      const snap = await db().collection("dossiers").doc(id).get();
      if (!snap.exists) return null;
      return { companyId: snap.data()!.companyId as string };
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
