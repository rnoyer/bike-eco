import {
  onSnapshot,
  type DocumentReference,
  type FirestoreError,
  type Query,
} from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

import type { WithId } from "@/lib/firestore/collections";
import { mapDataError } from "./dataErrors";

/**
 * The machinery every live hook in this folder shares — see the hook contract in
 * the `bike-eco-data` skill. One `{ key, data, error }` state object, `loading`
 * derived from a key match (so a snapshot answering a superseded query is never
 * rendered as the answer to the current one), and errors mapped to French copy.
 *
 * `key` carries the identity of the query being observed, and encodes what to do
 * when there is no query to run:
 *
 * - a non-empty string — subscribe, and report loading until a snapshot with
 *   this same key lands;
 * - `""` — **stay loading**. The inputs are not known yet but will be, e.g. a
 *   route param that resolves a tick late;
 * - `null` — **resolve to empty**. No legal query exists and none is coming,
 *   e.g. a b2b account with no `companyId`. Reporting empty rather than loading
 *   is what stops such a screen spinning forever.
 */
export function useLive<T>(
  key: string | null,
  empty: T,
  subscribe: (
    emit: (data: T) => void,
    fail: (err: FirestoreError) => void,
  ) => (() => void) | void,
): { data: T; loading: boolean; error: string | null } {
  const [resolved, setResolved] = useState<{
    key: string;
    data: T;
    error: string | null;
  } | null>(null);

  // `subscribe` closes over the caller's props and so is a fresh function every
  // render. `key` is the contract for query identity, so the effect stays keyed
  // on it alone and reaches the current closure through a ref — keying the
  // effect on the closure itself would resubscribe on every render.
  //
  // The ref is refreshed in its own effect (not during render), and declared
  // *before* the subscribing effect so that on a render where `key` changed the
  // fresh closure is already in place when the resubscribe runs.
  const latest = useRef(subscribe);
  useEffect(() => {
    latest.current = subscribe;
  });

  useEffect(() => {
    if (!key) return;
    return latest.current(
      (data) => setResolved({ key, data, error: null }),
      (err) => setResolved({ key, data: empty, error: mapDataError(err.code) }),
    );
    // `empty` is a constant per call site; `subscribe` is read through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // No key at all: `""` waits, `null` settles empty.
  const loading = key ? resolved?.key !== key : key === "";
  const settled = Boolean(key) && !loading;

  return {
    data: settled ? resolved!.data : empty,
    loading,
    error: settled ? resolved!.error : null,
  };
}

/** Stable identity so an idle list hook doesn't hand out a fresh array each render. */
const NO_ROWS: readonly never[] = [];

/** Live single document, carrying its id. `null` once loaded means "no such doc". */
export function useLiveDoc<T>(
  key: string | null,
  ref: () => DocumentReference<T>,
): { data: WithId<T> | null; loading: boolean; error: string | null } {
  return useLive<WithId<T> | null>(key, null, (emit, fail) =>
    onSnapshot(
      ref(),
      (snap) => emit(snap.exists() ? { ...snap.data(), id: snap.id } : null),
      fail,
    ),
  );
}

/**
 * Live query result, every row carrying its id. `select` runs on each snapshot,
 * for the sorting or filtering that belongs to the subscription rather than to
 * the render (`useColleagues` drops the signed-in user and sorts by name).
 */
export function useLiveQuery<T>(
  key: string | null,
  build: () => Query<T>,
  select?: (rows: WithId<T>[]) => WithId<T>[],
): { data: WithId<T>[]; loading: boolean; error: string | null } {
  return useLive<WithId<T>[]>(
    key,
    NO_ROWS as unknown as WithId<T>[],
    (emit, fail) =>
      onSnapshot(
        build(),
        (snap) => {
          const rows = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
          emit(select ? select(rows) : rows);
        },
        fail,
      ),
  );
}
