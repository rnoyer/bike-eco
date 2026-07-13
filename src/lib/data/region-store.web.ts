import type { Region } from "@/lib/firestore/schema";

// Web override of region-store: the native file persists through
// `expo-sqlite/kv-store`, but on web that drags in expo-sqlite's WASM SQLite
// worker (which Metro can't bundle without extra COOP/COEP + worker setup).
// A single string filter only needs `localStorage`, so we back the web build
// with it and keep the same async API as the native module.

const KEY = "bo.regionFilter";

export async function loadRegion(): Promise<Region | null> {
  const raw = globalThis.localStorage?.getItem(KEY) ?? null;
  return raw === "NORTH" || raw === "SOUTH" ? raw : null;
}

export async function saveRegion(region: Region | null): Promise<void> {
  globalThis.localStorage?.setItem(KEY, region ?? "ALL");
}
