import { useEffect, useState } from "react";
import {
  onSnapshot,
  orderBy,
  query,
  where,
  type FirestoreError,
  type QueryConstraint,
} from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { dossiersRef, type WithId } from "@/lib/firestore/collections";
import type { Dossier, DossierStatus, Region } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

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
  const key = `${statuses.join(",")}|${region ?? "ALL"}|${role ?? ""}|${companyId ?? ""}`;

  const [resolved, setResolved] = useState<{
    key: string;
    data: WithId<Dossier>[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!role) return;
    // A b2b user with no company cannot form a legal query; `noCompany` below
    // resolves them to empty rather than leaving them to spin.
    if (role === "b2b" && !companyId) return;

    const constraints: QueryConstraint[] =
      role === "b2b"
        ? [where("companyId", "==", companyId), where("status", "in", statuses)]
        : region
          ? [where("region", "==", region), where("status", "in", statuses)]
          : [where("status", "in", statuses)];

    return onSnapshot(
      query(dossiersRef, ...constraints, orderBy("createdAt")),
      (snap) =>
        setResolved({
          key,
          data: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key, data: [], error: mapDataError(err.code) }),
    );
    // `statuses` and `region` are captured by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, companyId, key]);

  const noCompany = role === "b2b" && !companyId;
  const loading = !noCompany && resolved?.key !== key;

  return {
    data: loading || noCompany ? [] : resolved!.data,
    loading,
    error: loading || noCompany ? null : resolved!.error,
  };
}
