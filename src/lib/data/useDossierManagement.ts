import { useCallback } from "react";
import { serverTimestamp, updateDoc } from "firebase/firestore";

import { dossierDoc } from "@/lib/firestore/collections";
import type { DossierStatus, Region } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/**
 * Back-office status / région / prix négocié update (page-dossier-management).
 * These four fields are exactly what the update rule allows.
 */
export function useDossierManagement() {
  const updateManagement = useCallback(
    async (
      id: string,
      region: Region,
      status: DossierStatus,
      price: number | null,
    ) => {
      try {
        await updateDoc(dossierDoc(id), {
          region,
          status,
          negotiatedPrice: price,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        throw new Error(mapDataError((error as { code?: string }).code ?? ""));
      }
    },
    [],
  );

  return { updateManagement };
}
