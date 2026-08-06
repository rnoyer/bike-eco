---
name: bike-eco-data
description: >-
  Use when reading or writing app data in the bike-eco Expo app — a Firestore
  query, a live listener or use* hook, filtering or sorting a dashboard list,
  adding a field or collection to the data model, a converter or typed ref, a
  composite index, a security rule, a "permission-denied" or "missing index"
  error, or persisting a local preference across restarts.
---

# Data in bike-eco

App data lives in the **named `bike-eco-db`** database (Standard edition), not
`(default)`. The client is built in `firebaseConfig.ts` (`db`, `storage`, `app`); the
admin side calls `db()` from `functions/src/callable.ts`, which also names the database.

Activate the `firebase-firestore` skill for Firestore mechanics. This skill covers what is
specific to bike-eco. Gate with `docs/tech/verification.md`; the model is documented in
`docs/tech/firestore-data-model.md`.

## The model

`src/lib/firestore/schema.ts` types every collection; `collections.ts` exposes
converter-backed refs. **Change one, change the other in the same commit.**

```
companies/{companyId}
users/{uid}
invitations/{invitationId}
dossiers/{dossierId}                          (B2B only — B2C is email-only, nothing persisted)
dossiers/{dossierId}/messages/{messageId}
```

- Refs: `companiesRef`, `usersRef`, `invitationsRef`, `dossiersRef`, `messagesRef(dossierId)`.
- Docs: `companyDoc(id)`, `userDoc(uid)`, `invitationDoc(id)`, `dossierDoc(id)`, `messageDoc(dossierId, messageId)`.
- `WithId<T>` = the doc type plus its `id` — Firestore docs don't carry their own id, so
  every read that needs one spreads `{ ...d.data(), id: d.id }`.
- The converter is an **identity** converter with one deliberate twist: it reads with
  `serverTimestamps: "estimate"`, so a pending `serverTimestamp()` arrives as an estimated
  local `Timestamp` instead of `null`. Consumers call `.toMillis()` / `.toDate()` on
  `createdAt` (dashboard sort, `ChatThread`) and would throw on null. Keep it.
- `role`, `companyId` and `status` are **server-set Auth claims**, never client-writable.
- `isAdmin` is server-set too, but lives **only** on the `users/{uid}` document — it is
  deliberately never mirrored into custom claims (a claim would go stale until the
  promoted user's ID token refreshed). The read rule lets an active teammate (same
  `companyId`) read each other's profile, not just the owner and back-office; `useColleagues`
  / `useUser` are the hooks over that rule (`src/lib/data/colleagues.ts`).
- Statuses are `const` tuples (`DOSSIER_STATUSES`, `USER_STATUSES`, `COMPANY_STATUSES`)
  with types derived from them — add a value to the tuple, not to a hand-written union.

## Security rules shape the query

**The most important rule here.** The b2b read rule is
`resource.data.companyId == myCompany()`, and Firestore rejects any list query it cannot
*statically* prove satisfies that rule. So `useDossiers` carries
`where("companyId", "==", companyId)` as a **requirement, not an optimization**:

```ts
const constraints: QueryConstraint[] =
  role === "b2b"
    ? [where("companyId", "==", companyId), where("status", "in", statuses)]
    : region
      ? [where("region", "==", region), where("status", "in", statuses)]
      : [where("status", "in", statuses)];
```

Filtering client-side instead — fetching all dossiers then narrowing in JS — fails with
`permission-denied`, not with a smaller result set. **When adding a dashboard filter
(highlighting a selected company's or user's dossiers), decide first whether it is a
query constraint or a presentation concern.** Narrowing which documents a user may see is
a constraint and needs a rule that permits it; merely emphasising rows already returned by
a legal query is presentation, and belongs in the component.

Any new `where` + `orderBy` combination needs a composite index in
`firestore.indexes.json`. A missing index surfaces as a console error carrying a
create-index URL.

Rules live in `firestore.rules` (default-deny, auth required) and `storage.rules`, and are
tested by `npm run test:rules` — see `docs/tech/verification.md`.

## The `use*` hook contract

Live-list hooks (`useDossiers`, `useMessages`, `useCompanies`, `useDossier`) share one
shape. Copy it rather than inventing a variant.

1. Build a `key` string capturing **query identity** — every input that changes the query
   (`statuses.join(",")`, region, role, companyId). `statuses` is a fresh array each
   render, so key on contents, not identity.
2. Hold `{ key, data, error }` in one state object, and derive
   `loading = resolved?.key !== key`. A snapshot that arrives for a superseded query is
   therefore never rendered as if it answered the current one.
3. Subscribe with `onSnapshot`, returning its unsubscribe from the effect.
4. Map the error through `mapDataError(err.code)` — hooks return **French copy**, never a
   raw Firebase code.
5. Return `{ data, loading, error }` — and expect all three to be consumed. A screen that
   destructures only `{ data }` renders an offline or denied read as an empty list.
   `Section` takes `loading` + `error`; `ScreenLoader` / `ScreenMessage` do the same for a
   whole screen. Never `return null` while loading.
6. Resolve impossible queries to empty rather than leaving them to spin: a b2b user with
   no `companyId` cannot form a legal query, so `useDossiers` reports empty, not loading.
7. Return `WithId<T>` whenever the id is evidence, not just a React key — `useMessages`
   does, because `useSendMessage` drops an optimistic bubble when the id it minted appears.

## Mutation hooks

Writes return **`{ …action, pending, error }`**, composing `useAsyncAction`
(`src/lib/ui/useAsyncAction.ts`) rather than leaving the caller to own a pending flag —
which is exactly what three of four call sites forgot to do. `useInvite` and
`useDossierManagement` are the pattern: they take the optional `AsyncActionOptions` through
so the screen can supply `onError`, and their action resolves to `true` on success and
`undefined` on failure, so the caller navigates on the result.

A write that must not hang forever offline goes through `writeWithTimeout` (15 s):
Firestore buffers a write it cannot reach the server with, so `updateDoc`/`setDoc` neither
resolve nor reject and the screen sits live and silent. Pass a `compensate` callback only
when there is something to undo (uploaded files); an update has nothing.

`useRegionFilter` also exposes `ready`, false until the persisted région hydrates. A
région-scoped consumer must hold its loading state until then, and the store keeps a
`userSet` flag so a choice made inside the hydration window is not overwritten by the
stored value landing afterwards.

`mapDataError` (`src/lib/data/dataErrors.ts`) is pure and imports no Firebase config, so
it stays testable under the `jest-expo` config that stubs `firebase/firestore`. Keep new
helpers pure for the same reason.

## Callables

Writes that need privilege go through a Cloud Function, not a client write. `call()` and
`frenchError()` in `src/lib/data/callable.ts` wrap them; see `bike-eco-functions`.

## Local preferences

`useRegionFilter` is the pattern for a preference shared across screens and persisted
across restarts: module-level state + `useSyncExternalStore` + a `region-store.ts` /
`region-store.web.ts` platform split for the storage backend.

A plain `useState` is wrong here — the back-office Settings picker and the dashboard
render in **sibling NativeTabs that stay mounted together**, so a per-component state
leaves the dashboard showing a stale value after the picker changes it. Export a
`__reset*ForTests` so each test hydrates fresh.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Client-side filtering instead of a `where` constraint | `permission-denied` — rules must be statically provable |
| Editing `schema.ts` without `collections.ts` (or vice versa) | Types and converters drift; reads silently mistyped |
| Dropping `serverTimestamps: "estimate"` | `.toMillis()` throws on a just-written doc |
| Keying a listener effect on an array/object dep | Re-subscribes every render |
| Returning a raw Firebase error code to the UI | Untranslated copy leaks to the user |
| A mutation hook that returns only its action | Every caller re-invents (or forgets) the pending flag |
| A bare `updateDoc`/`setDoc` on a user-initiated write | Buffers forever offline; the promise never settles |
| New `where` + `orderBy` without an index | Query fails at runtime with a create-index URL |
| `useState` for a cross-tab preference | Sibling NativeTabs keep stale values |
| Writing `role` / `companyId` / `status` from the client | Rejected — server-set claims only |
