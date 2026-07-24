import type { WithId } from "@/lib/firestore/collections";
import type { Company, Region } from "@/lib/firestore/schema";

/**
 * Region filtering for the back-office companies list. Applied client-side
 * (companies are a small set) so the queries need only `status + orderBy`
 * composite indexes. `null` region = "Toute la France" = no filter.
 */
export function filterCompaniesByRegion(
  companies: WithId<Company>[],
  region: Region | null,
): WithId<Company>[] {
  if (!region) return companies;
  return companies.filter((c) => c.region === region);
}
