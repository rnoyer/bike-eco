import { useCallback, useSyncExternalStore } from "react";
import type { Region } from "@/lib/firestore/schema";
import { loadRegion, saveRegion } from "./region-store";

/**
 * Shared region-filter store. The back-office Settings picker and the dashboard
 * render in sibling NativeTabs that stay mounted together, so the selection must
 * be a single source of truth — a plain per-component `useState` would let the
 * dashboard keep a stale value after the picker changes it. We back the hook
 * with module-level state + `useSyncExternalStore` so every consumer re-renders
 * on any change, while still persisting to (and hydrating from) kv-store.
 */
let region: Region | null = null;
let ready = false;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function hydrateOnce() {
  if (hydrated) return;
  hydrated = true;
  loadRegion()
    .then((r) => {
      region = r;
      ready = true;
      emit();
    })
    .catch(() => {
      ready = true;
      emit();
    });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrateOnce();
  return () => {
    listeners.delete(listener);
  };
}

const getRegion = () => region;
const getReady = () => ready;

/** Test-only: reset the module store so each test hydrates from a fresh mock. */
export function __resetRegionFilterForTests() {
  region = null;
  ready = false;
  hydrated = false;
  listeners.clear();
}

export function useRegionFilter() {
  const regionValue = useSyncExternalStore(subscribe, getRegion, getRegion);
  const readyValue = useSyncExternalStore(subscribe, getReady, getReady);

  const setRegion = useCallback((r: Region | null) => {
    region = r;
    emit();
    void saveRegion(r).catch(console.error);
  }, []);

  return { region: regionValue, setRegion, ready: readyValue };
}
