import { useCallback } from "react";
import type { DossierStatus, Region } from "@/lib/firestore/schema";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** Stubbed mutations — log + resolve. Swap to Firestore writes later. */
export function useDossierMutations() {
  const updateManagement = useCallback(
    async (
      id: string,
      region: Region,
      status: DossierStatus,
      price: number | null
    ) => {
      await delay();
      console.log("[stub] update", { id, region, status, price });
    },
    []
  );
  const sendMessage = useCallback(async (id: string, text: string) => {
    await delay();
    console.log("[stub] sendMessage", { id, text });
  }, []);
  const invite = useCallback(async (email: string) => {
    await delay();
    console.log("[stub] invite", { email });
  }, []);
  return { updateManagement, sendMessage, invite };
}
