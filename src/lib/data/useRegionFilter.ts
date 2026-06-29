import { useCallback, useEffect, useState } from "react";
import type { Region } from "@/lib/firestore/schema";
import { loadRegion, saveRegion } from "./region-store";

export function useRegionFilter() {
  const [region, setRegionState] = useState<Region | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadRegion()
      .then((r) => {
        if (active) {
          setRegionState(r);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const setRegion = useCallback((r: Region | null) => {
    setRegionState(r);
    void saveRegion(r).catch(console.error);
  }, []);

  return { region, setRegion, ready };
}
