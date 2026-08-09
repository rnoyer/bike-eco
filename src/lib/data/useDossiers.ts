import { orderBy, query, where, type QueryConstraint } from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { dossiersRef } from "@/lib/firestore/collections";
import type { Dossier, DossierStatus, Region } from "@/lib/firestore/schema";
import { useLiveQuery } from "./useLive";

/**
 * Live dossier list scoped to the session's claims.
 *
 * The b2b `companyId` constraint is required, not an optimization: the read rule
 * is `resource.data.companyId == myCompany()`, and Firestore rejects any list
 * query it cannot statically prove satisfies that rule.
 *
 * `region` is the back-office's "Région gérée" preference (null = Toute la
 * France); it has no meaning for b2b, whose dossiers are company-scoped.
 */
export function useDossiers(statuses: DossierStatus[], region?: Region | null) {
  const { session } = useAuth();
  const role = session?.role ?? null;
  const companyId = session?.companyId ?? null;

  // Identity of the query being observed. `statuses` is a fresh array on every
  // render, so key on its contents; role/companyId change the query too.
  // No role yet means the session is still resolving — wait (`""`). A b2b user
  // with no company can never form a legal query — resolve to empty (`null`).
  const key =
    role === null
      ? ""
      : role === "b2b" && !companyId
        ? null
        : `${statuses.join(",")}|${region ?? "ALL"}|${role}|${companyId ?? ""}`;

  return useLiveQuery<Dossier>(key, () => {
    const constraints: QueryConstraint[] =
      role === "b2b"
        ? [where("companyId", "==", companyId), where("status", "in", statuses)]
        : region
          ? [where("region", "==", region), where("status", "in", statuses)]
          : [where("status", "in", statuses)];
    return query(dossiersRef, ...constraints, orderBy("createdAt"));
  });
}
