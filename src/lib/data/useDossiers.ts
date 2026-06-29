import { useEffect, useState } from "react";
import type { Dossier, DossierStatus, Region } from "@/lib/firestore/schema";
import { MOCK_DOSSIERS, type WithId } from "./fixtures";
import { filterDossiersByRegion, selectByStatus } from "./filter";

/** Simulates an async fetch so the swap to a Firestore listener is invisible. */
export function useDossiers(statuses: DossierStatus[], region?: Region | null) {
  const [data, setData] = useState<WithId<Dossier>[]>([]);
  const [loading, setLoading] = useState(true);
  const key = statuses.join(",") + "|" + (region ?? "ALL");

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const byStatus = selectByStatus(MOCK_DOSSIERS, statuses);
      const sorted = [...byStatus].sort(
        (a, b) => a.createdAt.toMillis() - b.createdAt.toMillis()
      );
      setData(filterDossiersByRegion(sorted, region ?? null));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading };
}
