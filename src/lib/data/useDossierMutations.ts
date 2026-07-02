import { useCallback } from "react";
import type { DossierStatus } from "@/lib/firestore/schema";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** Stubbed mutations — log + resolve. Swap to Firestore writes later. */
export function useDossierMutations() {
  const updateStatusAndPrice = useCallback(
    async (id: string, status: DossierStatus, price: number | null) => {
      await delay();
      console.log("[stub] update", { id, status, price });
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
  return { updateStatusAndPrice, sendMessage, invite };
}
