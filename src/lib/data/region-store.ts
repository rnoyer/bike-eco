import Storage from "expo-sqlite/kv-store";
import type { Region } from "@/lib/firestore/schema";

const KEY = "bo.regionFilter";

export async function loadRegion(): Promise<Region | null> {
  const raw = await Storage.getItem(KEY);
  return raw === "NORTH" || raw === "SOUTH" ? raw : null;
}

export async function saveRegion(region: Region | null): Promise<void> {
  await Storage.setItem(KEY, region ?? "ALL");
}
