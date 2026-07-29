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
/** Set once the user picks a région themselves. A pick made *inside* the
 *  hydration window has to win: otherwise the stored value lands a moment later
 *  and silently overwrites the choice the user just made. */
let userSet = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

/** kv-store is local, so this only fires if the native side is wedged — but
 *  `ready` now gates whole screens, so an unsettled read would spin the
 *  back-office dashboard forever with no error state and no retry. Falling
 *  through to "Toute la France" is the right failure. */
const HYDRATION_TIMEOUT_MS = 3000;

function hydrateOnce() {
  if (hydrated) return;
  hydrated = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  Promise.race([
    loadRegion(),
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("hydration timed out")),
        HYDRATION_TIMEOUT_MS,
      );
    }),
  ])
    .then((r) => {
      if (!userSet) region = r;
      ready = true;
      emit();
    })
    .catch(() => {
      ready = true;
      emit();
    })
    // Without this the pending timer keeps the process alive for its full
    // duration after hydration has already resolved.
    .finally(() => {
      if (timer) clearTimeout(timer);
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
  userSet = false;
  listeners.clear();
}

export function useRegionFilter() {
  const regionValue = useSyncExternalStore(subscribe, getRegion, getRegion);
  const readyValue = useSyncExternalStore(subscribe, getReady, getReady);

  const setRegion = useCallback((r: Region | null) => {
    userSet = true;
    region = r;
    emit();
    void saveRegion(r).catch(console.error);
  }, []);

  // `ready` is false until the persisted région has hydrated. Consumers whose
  // query is région-scoped must hold their loading state until then, or their
  // first render answers a "Toute la France" query and visibly re-queries.
  return { region: regionValue, setRegion, ready: readyValue };
}
