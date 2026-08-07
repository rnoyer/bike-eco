import { serverTimestamp, updateDoc } from "firebase/firestore";

import { dossierDoc } from "@/lib/firestore/collections";
import type { DossierStatus, Region } from "@/lib/firestore/schema";
import {
  WRITE_TIMEOUT_MS,
  writeWithTimeout,
} from "@/lib/firestore/writeWithTimeout";
import { useAsyncAction, type AsyncActionOptions } from "@/lib/ui/useAsyncAction";
import { mapDataError } from "./dataErrors";

/**
 * Back-office status / région / prix validé update (page-dossier-management).
 * These five fields are exactly what the update rule allows.
 *
 * `actorUid` is written to `updatedBy` because the notification trigger fires
 * on `onDocumentUpdated`, which carries no auth context — without it the
 * trigger cannot skip the member who made the change.
 *
 * Raced against the shared write timeout: offline, Firestore buffers the write
 * and `updateDoc` neither resolves nor rejects, so the screen would sit with a
 * live button and never navigate or error. There is nothing to compensate — an
 * update commits no uploads and creates no document — so a late-landing write
 * is simply the update the user asked for.
 */
export function useDossierManagement(options?: AsyncActionOptions) {
  const { run, pending, error } = useAsyncAction(
    async (
      id: string,
      region: Region,
      status: DossierStatus,
      price: number | null,
      actorUid: string,
    ) => {
      try {
        await writeWithTimeout(
          () =>
            updateDoc(dossierDoc(id), {
              region,
              status,
              validatedPrice: price,
              updatedBy: actorUid,
              updatedAt: serverTimestamp(),
            }),
          () => {},
          WRITE_TIMEOUT_MS,
        );
      } catch (err) {
        throw new Error(mapDataError((err as { code?: string }).code ?? ""));
      }
      return true as const;
    },
    options,
  );

  return { updateManagement: run, pending, error };
}
