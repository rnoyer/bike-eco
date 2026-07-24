import { useEffect, useState } from "react";
import {
  doc, onSnapshot, orderBy, query, where,
  type FirestoreError,
} from "firebase/firestore";

import { companiesRef, usersRef, type WithId } from "@/lib/firestore/collections";
import type { AppUser, Company, CompanyStatus, Region } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";
import { filterCompaniesByRegion } from "./selectCompanies";

/**
 * Live company list for the back office. Pending companies sort oldest-first
 * (createdAt asc); active companies sort by most-recent validation
 * (validatedAt desc) — so every active company must carry `validatedAt`.
 * Region is filtered client-side (see `filterCompaniesByRegion`).
 */
export function useCompanies(status: CompanyStatus, region?: Region | null) {
  const [resolved, setResolved] = useState<{
    status: CompanyStatus;
    data: WithId<Company>[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    const q =
      status === "pending"
        ? query(companiesRef, where("status", "==", "pending"), orderBy("createdAt", "asc"))
        : query(companiesRef, where("status", "==", "active"), orderBy("validatedAt", "desc"));
    return onSnapshot(
      q,
      (snap) => setResolved({ status, data: snap.docs.map((d) => ({ ...d.data(), id: d.id })), error: null }),
      (err: FirestoreError) => setResolved({ status, data: [], error: mapDataError(err.code) }),
    );
  }, [status]);

  const loading = resolved?.status !== status;
  return {
    data: loading ? [] : filterCompaniesByRegion(resolved!.data, region ?? null),
    loading,
    error: loading ? null : resolved!.error,
  };
}

/** Single company document, live. */
export function useCompany(id: string) {
  const [resolved, setResolved] = useState<{
    id: string;
    data: WithId<Company> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    return onSnapshot(
      doc(companiesRef, id),
      (snap) => setResolved({ id, data: snap.exists() ? { ...snap.data(), id: snap.id } : null, error: null }),
      (err: FirestoreError) => setResolved({ id, data: null, error: mapDataError(err.code) }),
    );
  }, [id]);

  const loading = resolved?.id !== id;
  return { data: loading ? null : resolved!.data, loading, error: loading ? null : resolved!.error };
}

/** All users of a company, live. */
export function useCompanyUsers(companyId: string) {
  const [resolved, setResolved] = useState<{
    companyId: string;
    data: WithId<AppUser>[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(usersRef, where("companyId", "==", companyId)),
      (snap) => setResolved({ companyId, data: snap.docs.map((d) => ({ ...d.data(), id: d.id })), error: null }),
      (err: FirestoreError) => setResolved({ companyId, data: [], error: mapDataError(err.code) }),
    );
  }, [companyId]);

  const loading = resolved?.companyId !== companyId;
  return { data: loading ? [] : resolved!.data, loading, error: loading ? null : resolved!.error };
}
