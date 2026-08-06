import { onSnapshot, query, where, type FirestoreError } from "firebase/firestore";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { usersRef, type WithId } from "@/lib/firestore/collections";
import type { AppUser } from "@/lib/firestore/schema";
import { colleagueScope, sortByName } from "./colleagues";
import { mapDataError } from "./dataErrors";

/**
 * Live colleagues of the signed-in user — their company for a b2b account, the
 * back-office team for a back-office one — excluding themselves (you manage
 * your own account on "Mon compte").
 */
export function useColleagues() {
  const { session } = useAuth();
  const scope = colleagueScope(session);
  const uid = session?.id ?? "";
  // A primitive key, so the effect does not re-subscribe on every session
  // object identity change.
  const key = scope ? (scope.kind === "backoffice" ? "backoffice" : scope.companyId) : "";

  const [resolved, setResolved] = useState<{
    key: string;
    data: WithId<AppUser>[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    // No scope — no session yet, or a b2b account without a company — can't
    // drive a legal query; don't subscribe. Leave `resolved` unset so the
    // hook reports empty/not-loading below instead of spinning forever: a
    // scopeless session is a durable state (e.g. an orphaned b2b account),
    // not a transient one like `useDossier`'s not-yet-resolved route param.
    if (!key || !uid) return;
    const q =
      key === "backoffice"
        ? query(usersRef, where("role", "==", "backoffice"))
        : query(usersRef, where("companyId", "==", key));
    return onSnapshot(
      q,
      (snap) =>
        setResolved({
          key,
          data: sortByName(
            snap.docs.map((d) => ({ ...d.data(), id: d.id })).filter((u) => u.id !== uid),
          ),
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key, data: [], error: mapDataError(err.code) }),
    );
  }, [key, uid]);

  const noScope = !key || !uid;
  const loading = !noScope && resolved?.key !== key;
  return {
    data: loading || noScope ? [] : resolved!.data,
    loading,
    error: loading || noScope ? null : resolved!.error,
  };
}
