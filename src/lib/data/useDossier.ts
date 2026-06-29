import { useEffect, useState } from "react";
import type { Dossier } from "@/lib/firestore/schema";
import { MOCK_DOSSIERS, type WithId } from "./fixtures";

export function useDossier(id: string) {
  const [resolved, setResolved] = useState<{
    id: string;
    data: WithId<Dossier> | null;
  } | null>(null);
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      if (active)
        setResolved({ id, data: MOCK_DOSSIERS.find((d) => d.id === id) ?? null });
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [id]);
  const loading = resolved?.id !== id;
  return { data: loading ? null : resolved!.data, loading };
}
