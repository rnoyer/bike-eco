import { doc, orderBy, query, where } from "firebase/firestore";

import { companiesRef, usersRef } from "@/lib/firestore/collections";
import type {
  AppUser,
  Company,
  CompanyStatus,
  Region,
} from "@/lib/firestore/schema";
import { filterCompaniesByRegion } from "./selectCompanies";
import { useLiveDoc, useLiveQuery } from "./useLive";

/**
 * Live company list for the back office. Pending companies sort oldest-first
 * (createdAt asc); active companies sort by most-recent validation
 * (validatedAt desc) — so every active company must carry `validatedAt`.
 * Region is filtered client-side (see `filterCompaniesByRegion`), which is why
 * it stays out of the key: changing it re-filters without resubscribing.
 */
export function useCompanies(status: CompanyStatus, region?: Region | null) {
  const { data, loading, error } = useLiveQuery<Company>(status, () =>
    status === "pending"
      ? query(
          companiesRef,
          where("status", "==", "pending"),
          orderBy("createdAt", "asc"),
        )
      : query(
          companiesRef,
          where("status", "==", "active"),
          orderBy("validatedAt", "desc"),
        ),
  );
  return {
    data: filterCompaniesByRegion(data, region ?? null),
    loading,
    error,
  };
}

/** Single company document, live. An empty id cannot form a valid doc path, and
 *  none is coming — resolve to not-found rather than spinning. */
export function useCompany(id: string) {
  return useLiveDoc<Company>(id || null, () => doc(companiesRef, id));
}

/** All users of a company, live. An empty companyId can't drive a legal `where`
 *  query — report empty rather than loading. */
export function useCompanyUsers(companyId: string) {
  return useLiveQuery<AppUser>(companyId || null, () =>
    query(usersRef, where("companyId", "==", companyId)),
  );
}
