import type { Dossier, DossierStatus, Region } from "@/lib/firestore/schema";
import type { WithId } from "./fixtures";

export function selectByStatus(
  dossiers: WithId<Dossier>[],
  statuses: DossierStatus[]
): WithId<Dossier>[] {
  return dossiers.filter((d) => statuses.includes(d.status));
}

export function filterDossiersByRegion(
  dossiers: WithId<Dossier>[],
  region: Region | null
): WithId<Dossier>[] {
  if (region == null) return dossiers;
  return dossiers.filter((d) => d.region === region);
}
