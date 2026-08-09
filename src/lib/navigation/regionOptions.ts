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

/** The `Region` a dropdown label stands for. `null` for "Toute la France" — and
 *  for no label at all, since an unset optional picker means the same thing. */
export const regionFromLabel = (label: string | null): Region | null => {
  const option = REGION_OPTIONS.find((o) => o.label === label);
  return option ? toRegion(option.value) : null;
};
