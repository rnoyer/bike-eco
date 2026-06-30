import type { Region } from "@/lib/firestore/schema";

export type RegionChoice = "NORTH" | "SOUTH" | "ALL";

export const REGION_OPTIONS: { label: string; value: RegionChoice }[] = [
  { label: "Moitié Nord", value: "NORTH" },
  { label: "Moitié sud", value: "SOUTH" },
  { label: "Toute la France", value: "ALL" },
];

export const toRegion = (v: RegionChoice): Region | null =>
  v === "ALL" ? null : v;
export const fromRegion = (r: Region | null): RegionChoice => r ?? "ALL";
