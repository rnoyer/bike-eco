import { useEffect, useState } from "react";
import type { Dossier } from "@/lib/firestore/schema";
import { MOCK_DOSSIERS, type WithId } from "./fixtures";

export function useDossier(id: string) {
  const [data, setData] = useState<WithId<Dossier> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setData(MOCK_DOSSIERS.find((d) => d.id === id) ?? null);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [id]);
  return { data, loading };
}
