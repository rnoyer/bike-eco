import { query, where } from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { usersRef } from "@/lib/firestore/collections";
import type { AppUser } from "@/lib/firestore/schema";
import { colleagueScope, sortByName } from "./colleagues";
import { useLiveQuery } from "./useLive";

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
  // object identity change. No scope — no session yet, or a b2b account without
  // a company — cannot drive a legal query, and a scopeless session is a
  // durable state (e.g. an orphaned b2b account) rather than a transient one
  // like `useDossier`'s not-yet-resolved route param: resolve to empty (`null`),
  // don't spin.
  const scopeKey = scope
    ? scope.kind === "backoffice"
      ? "backoffice"
      : scope.companyId
    : "";
  const key = scopeKey && uid ? scopeKey : null;

  return useLiveQuery<AppUser>(
    key,
    () =>
      scopeKey === "backoffice"
        ? query(usersRef, where("role", "==", "backoffice"))
        : query(usersRef, where("companyId", "==", scopeKey)),
    (rows) => sortByName(rows.filter((u) => u.id !== uid)),
  );
}
