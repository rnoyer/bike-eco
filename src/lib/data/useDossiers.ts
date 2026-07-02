import { useEffect, useState } from "react";
import type { Dossier, DossierStatus, Region } from "@/lib/firestore/schema";
import { MOCK_DOSSIERS, type WithId } from "./fixtures";
import { filterDossiersByRegion, selectByStatus } from "./filter";

/** Simulates an async fetch so the swap to a Firestore listener is invisible. */
export function useDossiers(statuses: DossierStatus[], region?: Region | null) {
  const key = statuses.join(",") + "|" + (region ?? "ALL");
  const [resolved, setResolved] = useState<{ key: string; data: WithId<Dossier>[] } | null>(null);
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      const byStatus = selectByStatus(MOCK_DOSSIERS, statuses);
      const sorted = [...byStatus].sort(
        (a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()
      );
      if (active) setResolved({ key, data: filterDossiersByRegion(sorted, region ?? null) });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const loading = resolved?.key !== key;
  return { data: loading ? [] : resolved!.data, loading };
}
