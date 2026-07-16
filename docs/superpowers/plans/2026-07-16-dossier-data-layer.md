# Dossier Data Layer Implementation Plan (slices 2 & 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the stubbed dossier data layer with real Firestore — live `onSnapshot` reads (Phase A), then B2B submission, back-office management updates, and chat with attachments backed by Firestore + Storage writes (Phase B).

**Architecture:** The three read hooks keep their exact signatures and become `onSnapshot` listeners scoped by the session's custom claims. Writes go direct from the client, policed by narrow, claim-pinned security rules (Cloud Functions stay scoped to slice 4). Storage paths are keyed by `companyId` so Storage rules authorize from claims alone. A failed submission deletes what it already uploaded, so no orphans are left behind. Logic worth testing is extracted into pure modules that never import `firebaseConfig`; the rules are proven against the emulators.

**Tech Stack:** Expo SDK 56, React Native, expo-router, Firebase JS SDK `^12`, `@firebase/rules-unit-testing`, `expo-image-picker`, `expo-document-picker` (new), `expo-image-manipulator` (new), Jest (`jest-expo` preset + a separate node-env config for rules tests).

**Spec:** `docs/superpowers/specs/2026-07-16-dossier-data-layer-design.md` — read it before starting.

## Global Constraints

- **Firebase JS SDK only**, `firebase@^12`. Do NOT introduce React Native Firebase.
- App data lives in the **named `bike-eco-db`** database, not `(default)`.
- `role` / `companyId` / `region` / `status` are **server-set custom claims, never client-writable**. Rules are **default-deny**.
- **UI copy is French**, specific and actionable ("Vous n'avez pas accès à ce dossier.", never "Erreur").
- Style with `tokens` from `@/theme/tokens` — no colour/spacing literals.
- Import via the `@/*` alias (→ `src/*`). `firebaseConfig` is imported by **relative** path.
- **Expo SDK 56 APIs only.** `ImageManipulator.manipulateAsync` is **deprecated** — use `ImageManipulator.manipulate(uri)` → `.resize()` → `renderAsync()` → `saveAsync()`. Verify anything else at https://docs.expo.dev/versions/v56.0.0/.
- **Pure logic under test MUST NOT import `firebaseConfig` or `@/lib/firestore/collections`.** The `jest-expo` config maps `firebase/firestore` to `__mocks__/firebase/firestore.js`, which exports **only** `Timestamp`, `getFirestore`, `connectFirestoreEmulator`. Anything importing `collection`/`doc`/`onSnapshot` at module scope crashes under the main test config. `import type` is erased and always safe.
- Rules tests run under `jest.rules.config.js` (node env, real SDK), never the `jest-expo` preset.
- **Do NOT leave an emulator running while running `npm run test:rules`.** It uses `firebase emulators:exec`, which starts and stops its own Firestore + Storage emulators; a long-running one on 8080/9199 collides with it. `emulators:start` is only for the Tasks 5/13 walkthroughs.
- **Java version (verified 2026-07-16): this machine has JDK 17; `firebase-tools@latest` emulators want JDK 21.** Slice 1 found the Firestore-only emulator works on 17 but the **Auth** emulator does not. Whether the **Storage** emulator (new in this plan's `test:rules`) works on 17 is **unverified** — if Task 7 Step 6 fails with a Java error, do NOT redesign the tests: install a local JDK 21 (e.g. Temurin into the scratchpad) and set `JAVA_HOME` for that command, or fall back to `npx firebase-tools@13`. Report it either way so this line can be corrected.
- Département→region helpers are `isNord` / `isSud` (French names) in `src/constants/departments.ts`.
- **`docs/tech/firestore-data-model.md` documents the live `Dossier`/`Message` shape and MUST be kept in sync in the same change that alters the model** (AGENTS.md rule). `docs/specs/` and `docs/product/` describe product behaviour and need no change in this plan.
- **Out of scope:** `invite` and registration Cloud Functions (slice 4 — `useInvite` stays stubbed); Google sign-in (slice 1 Task 9, owner-blocked); Apple/Facebook; a scheduled sweep for orphans.

---

## File map

**Create:**
- `src/lib/data/dataErrors.ts` + `.test.ts` — `mapDataError`; pure.
- `src/lib/storage/paths.ts` + `.test.ts` — Storage path layout; pure.
- `src/lib/storage/cleanup.ts` + `.test.ts` — `cleanUpOnFailure`; pure.
- `src/lib/storage/upload.ts` — Storage I/O + thumbnail (imports firebaseConfig; not unit-tested).
- `src/lib/chat/senderName.ts` + `.test.ts` — `formatSenderName`; pure.
- `src/features/b2b-submission/toDossier.ts` + `__tests__/toDossier.test.ts` — form→document; pure.
- `src/lib/data/useDossierManagement.ts`, `src/lib/data/useSendMessage.ts`, `src/lib/data/useInvite.ts`.
- `src/lib/firestore/__tests__/storageRules.test.ts`.

**Modify:**
- `src/lib/firestore/schema.ts` — drop `lastMessageAt`, `assignedTo`.
- `src/lib/data/useDossiers.ts`, `useDossier.ts`, `useMessages.ts` — live listeners.
- `src/features/b2b-submission/submit.ts` — real submission.
- `src/app/(b2b)/vehicule-submission.tsx` — pass the session.
- `src/components/screens/DashboardScreen.tsx`, `src/components/ui/DossiersSection.tsx` — `WithId` import.
- `src/components/screens/DossierChatScreen.tsx`, `src/components/ui/chat/ChatComposer.tsx`.
- `src/app/(backoffice)/dossier/[id]/management.tsx`, `src/app/(b2b)/add-colleague.tsx`.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `firebase.json` (unchanged — already correct).
- `src/lib/firestore/__tests__/rules.test.ts`, `jest.rules.config.js`, `package.json`, `scripts/seed.ts`.

**Delete:**
- `src/lib/data/fixtures.ts`, `src/lib/data/filter.ts`, `src/lib/data/__tests__/filter.test.ts`, `src/lib/data/__tests__/useDossiers.test.ts`, `src/lib/data/useDossierMutations.ts`.

---

# PHASE A — Reads (slice 2)

## Task 1: `mapDataError` — French data-error copy (TDD)

**Files:**
- Create: `src/lib/data/dataErrors.ts`, `src/lib/data/dataErrors.test.ts`

**Interfaces:**
- Produces: `mapDataError(code: string): string`. Consumed by every hook and write in this plan.

- [ ] **Step 1: Write the failing test**

Create `src/lib/data/dataErrors.test.ts`:
```ts
import { expect, test } from "@jest/globals";
import { mapDataError } from "./dataErrors";

test("firestore denial and absence have their own copy", () => {
  expect(mapDataError("permission-denied")).toBe(
    "Vous n'avez pas accès à ce dossier.",
  );
  expect(mapDataError("not-found")).toBe("Ce dossier n'existe plus.");
});

test("network problems tell the user to check their connection", () => {
  expect(mapDataError("unavailable")).toBe(
    "Connexion impossible. Vérifiez votre réseau.",
  );
  expect(mapDataError("storage/retry-limit-exceeded")).toBe(
    "Connexion impossible. Vérifiez votre réseau.",
  );
});

test("storage denial is about the file, not the dossier", () => {
  expect(mapDataError("storage/unauthorized")).toBe(
    "Vous n'avez pas accès à ce fichier.",
  );
});

test("unknown codes fall back to a generic French message", () => {
  expect(mapDataError("internal")).toBe(
    "Une erreur est survenue. Veuillez réessayer.",
  );
  expect(mapDataError("")).toBe("Une erreur est survenue. Veuillez réessayer.");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/lib/data/dataErrors.test.ts`
Expected: FAIL — `Cannot find module './dataErrors'`.

- [ ] **Step 3: Implement `dataErrors.ts`**

Create `src/lib/data/dataErrors.ts`:
```ts
/**
 * Firestore/Storage error codes → specific, actionable French copy.
 * Mirrors `@/lib/auth/authErrors`. Pure: no `firebaseConfig` import, so it stays
 * testable under the jest-expo config (which stubs `firebase/firestore`).
 */
// Only codes a real flow can produce. Anything else takes the fallback — an
// unreachable entry is a claim about behaviour that no test can check.
const MESSAGES: Record<string, string> = {
  // Firestore
  "permission-denied": "Vous n'avez pas accès à ce dossier.",
  "not-found": "Ce dossier n'existe plus.",
  unavailable: "Connexion impossible. Vérifiez votre réseau.",
  // Storage
  "storage/unauthorized": "Vous n'avez pas accès à ce fichier.",
  "storage/retry-limit-exceeded": "Connexion impossible. Vérifiez votre réseau.",
};

/** Map a Firestore/Storage error code to French user copy. */
export function mapDataError(code: string): string {
  return MESSAGES[code] ?? "Une erreur est survenue. Veuillez réessayer.";
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/lib/data/dataErrors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```sh
git add src/lib/data/dataErrors.ts src/lib/data/dataErrors.test.ts
git commit -m "feat(data): mapDataError French error copy"
```

---

## Task 2: Remove the dead `lastMessageAt` and `assignedTo` fields

Neither field is read or written anywhere — they exist only in fixtures and the seed. `component-dossiers-section.md` orders by submission date (`createdAt`), so the one plausible consumer of `lastMessageAt` is spec'd against it. See the spec's "On Decision 5".

**Files:**
- Modify: `src/lib/firestore/schema.ts`, `src/lib/data/fixtures.ts`, `scripts/seed.ts`

**Interfaces:**
- Produces: a `Dossier` type without `lastMessageAt` / `assignedTo`. Every later task's payloads omit them.

- [ ] **Step 1: Drop both fields from the `Dossier` interface**

In `src/lib/firestore/schema.ts`, the `Dossier` interface currently reads:
```ts
export interface Dossier {
  status: DossierStatus;
  region: Region; // initially derived from the submitter's departement; reassignable by the back-office (page-dossier-management)
  companyId: string;
  submittedBy: string; // uid
  assignedTo: string | null; // team member handling it
  negotiatedPrice: number | null; // back-office deal outcome (page-dossier-management)
```
Delete the `assignedTo` line so it becomes:
```ts
export interface Dossier {
  status: DossierStatus;
  region: Region; // initially derived from the submitter's departement; reassignable by the back-office (page-dossier-management)
  companyId: string;
  submittedBy: string; // uid
  negotiatedPrice: number | null; // back-office deal outcome (page-dossier-management)
```
Then delete the `lastMessageAt` line from the end of the same interface:
```ts
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastMessageAt: Timestamp | null;
}
```
becomes:
```ts
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- [ ] **Step 2: Drop them from the fixtures**

In `src/lib/data/fixtures.ts`, inside `makeDossier`, delete the `assignedTo: null,` line and the `lastMessageAt: ts("2026-06-22"),` line. (This file is deleted entirely in Task 4; it only needs to compile until then.)

- [ ] **Step 3: Drop them from the seed**

In `scripts/seed.ts`, the dossier loop currently contains:
```ts
      status, region, companyId: "comp_nord", submittedBy: "user_b2b",
      assignedTo: null, negotiatedPrice: null,
```
Change to:
```ts
      status, region, companyId: "comp_nord", submittedBy: "user_b2b",
      negotiatedPrice: null,
```
And:
```ts
      createdAt: now, updatedAt: now, lastMessageAt: null,
```
Change to:
```ts
      createdAt: now, updatedAt: now,
```

- [ ] **Step 4: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: all clean. If `tsc` reports either field still referenced, remove that reference too.

- [ ] **Step 5: Commit**

```sh
git add src/lib/firestore/schema.ts src/lib/data/fixtures.ts scripts/seed.ts
git commit -m "refactor(schema): drop unused lastMessageAt and assignedTo from Dossier"
```

---

## Task 3: `useDossiers` → live listener + composite indexes

**Files:**
- Modify: `src/lib/data/useDossiers.ts`, `firestore.indexes.json`
- Delete: `src/lib/data/__tests__/useDossiers.test.ts`

**Interfaces:**
- Consumes: `mapDataError` (Task 1); `useAuth()` from `@/lib/auth/AuthProvider` (returns `{ session, loading, ... }` where `session: SessionUser | null` carries `role` and `companyId`); `dossiersRef` and `WithId<T>` from `@/lib/firestore/collections`.
- Produces: `useDossiers(statuses: DossierStatus[], region?: Region | null): { data: WithId<Dossier>[]; loading: boolean; error: string | null }` — same signature as today, plus `error`.

- [ ] **Step 1: Delete the obsolete stub test**

```sh
git rm src/lib/data/__tests__/useDossiers.test.ts
```
It asserts the stub's `setTimeout` timing, which has no successor once the hook is a listener. Replacement coverage is the rules tests (Task 7) and the Phase A walkthrough (Task 5). Do NOT write a mock-based replacement — mocking `onSnapshot` would assert the mock, not the query.

- [ ] **Step 2: Rewrite `useDossiers.ts`**

Replace the whole file:
```ts
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
```

> **Two constraints shape this, do not "simplify" them away.**
> 1. `loading` is **derived** from a resolved-key, never `setState`-ed inside the
>    effect body. `expo lint` (React Compiler) flags synchronous setState-in-effect;
>    setState inside the async `onSnapshot` callbacks is fine. This is why the stub
>    it replaces used the same resolved-key shape.
> 2. The effect gates on `role`, **not** on `useAuth().loading`. That flag flips
>    true on every token refresh, which would tear down and rebuild every listener
>    and flash the dashboard. Session presence is the real precondition.

- [ ] **Step 3: Declare the composite indexes**

Replace `firestore.indexes.json` entirely:
```json
{
  "indexes": [
    {
      "collectionGroup": "dossiers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "companyId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "dossiers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "dossiers",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "region", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```
These cover the three query shapes: b2b sections, back-office "Toute la France", and back-office region-filtered. (`where("status", "in", …)` counts as an equality for index purposes, so it precedes the `orderBy` field.)

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. `DashboardScreen` reads only `.data`/`.loading`, so the added `error` breaks nothing.

- [ ] **Step 5: Run the full unit suite**

Run: `npx jest`
Expected: PASS. No test imports `useDossiers` any more.

- [ ] **Step 6: Commit**

```sh
git add src/lib/data/useDossiers.ts firestore.indexes.json
git commit -m "feat(data): live dossier list via onSnapshot with claim-scoped queries"
```

---

## Task 4: `useDossier` + `useMessages` → live listeners; retire the mock layer

**Files:**
- Modify: `src/lib/data/useDossier.ts`, `src/lib/data/useMessages.ts`, `src/components/screens/DashboardScreen.tsx`, `src/components/ui/DossiersSection.tsx`
- Delete: `src/lib/data/fixtures.ts`, `src/lib/data/filter.ts`, `src/lib/data/__tests__/filter.test.ts`

**Interfaces:**
- Consumes: `mapDataError` (Task 1); `dossierDoc`, `messagesRef`, `WithId` from `@/lib/firestore/collections`.
- Produces: `useDossier(id: string): { data: WithId<Dossier> | null; loading: boolean; error: string | null }`; `useMessages(dossierId: string): { data: Message[]; loading: boolean; error: string | null }`. `WithId<T>` is now imported from `@/lib/firestore/collections` everywhere.

- [ ] **Step 1: Rewrite `useDossier.ts`**

Replace the whole file:
```ts
import { useEffect, useState } from "react";
import { onSnapshot, type FirestoreError } from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { dossierDoc, type WithId } from "@/lib/firestore/collections";
import type { Dossier } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/** Live single dossier. Stays loading for an empty id (route params resolve late). */
export function useDossier(id: string) {
  const { session } = useAuth();
  const [resolved, setResolved] = useState<{
    key: string;
    data: WithId<Dossier> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!session || !id) return;
    return onSnapshot(
      dossierDoc(id),
      (snap) =>
        setResolved({
          key: id,
          data: snap.exists() ? { ...snap.data(), id: snap.id } : null,
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key: id, data: null, error: mapDataError(err.code) }),
    );
  }, [session, id]);

  // Guard the empty-id case: `undefined !== undefined` is false, which would
  // otherwise mark a missing id as "loaded" and dereference the null state.
  const loading = !id || resolved?.key !== id;

  return {
    data: loading ? null : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}
```

- [ ] **Step 2: Rewrite `useMessages.ts`**

Replace the whole file:
```ts
import { useEffect, useState } from "react";
import {
  onSnapshot,
  orderBy,
  query,
  type FirestoreError,
} from "firebase/firestore";

import { useAuth } from "@/lib/auth/AuthProvider";
import { messagesRef } from "@/lib/firestore/collections";
import type { Message } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/** Live chat thread for a dossier, oldest first. */
export function useMessages(dossierId: string) {
  const { session } = useAuth();
  const [resolved, setResolved] = useState<{
    key: string;
    data: Message[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!session || !dossierId) return;
    return onSnapshot(
      query(messagesRef(dossierId), orderBy("createdAt")),
      (snap) =>
        setResolved({
          key: dossierId,
          data: snap.docs.map((d) => d.data()),
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key: dossierId, data: [], error: mapDataError(err.code) }),
    );
  }, [session, dossierId]);

  const loading = !dossierId || resolved?.key !== dossierId;

  return {
    data: loading ? [] : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}
```

- [ ] **Step 3: Repoint the two `WithId` importers**

In `src/components/screens/DashboardScreen.tsx`, change:
```ts
import type { WithId } from "@/lib/data/fixtures";
```
to:
```ts
import type { WithId } from "@/lib/firestore/collections";
```

In `src/components/ui/DossiersSection.tsx`, make the identical change.

- [ ] **Step 4: Delete the mock layer**

```sh
git rm src/lib/data/fixtures.ts src/lib/data/filter.ts src/lib/data/__tests__/filter.test.ts
```
`filter.ts` (`selectByStatus`, `filterDossiersByRegion`) is dead now that the server filters — keeping it would leave two competing filter paths. `fixtures.ts` has nothing left: `MOCK_COMPANIES`/`MOCK_USERS` were already dead after slice 1, and its only other live export was a `WithId` forward. This completes slice 1's deferred "removal of `fixtures.ts`".

- [ ] **Step 5: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: all clean. If `tsc` reports another `@/lib/data/fixtures` importer, repoint it to `@/lib/firestore/collections` the same way.

- [ ] **Step 6: Commit**

```sh
git add -A src/lib/data src/components/screens/DashboardScreen.tsx src/components/ui/DossiersSection.tsx
git commit -m "feat(data): live dossier + messages listeners; remove the fixture layer"
```

---

## Task 5: Phase A verification walkthrough

**Files:** none (verification gate).

**Interfaces:**
- Consumes: Tasks 1–4; `scripts/seed.ts`; the emulator config already in `firebase.json`.

- [ ] **Step 1: Start the emulators**

Run (terminal 1):
```sh
npx -y firebase-tools@latest emulators:start --only auth,firestore,storage --project bike-eco-43a84
```
Expected: auth on 9099, firestore on 8080, storage on 9199, Emulator UI up.

- [ ] **Step 2: Seed**

Run (terminal 2): `npm run seed`
Expected: `Seed complete: user_b2b / user_bo / user_pending (password123).`

- [ ] **Step 3: Run the app against the emulators**

Run (terminal 3): `EXPO_PUBLIC_USE_EMULATORS=1 npx expo start`

- [ ] **Step 4: Verify the b2b read path**

Sign in as `b2b@garage-nord.fr` / `password123`.
Expected: the dashboard lists the seeded `comp_nord` dossiers, split into "Dossiers en cours" (a_traiter + en_cours) and "Dossiers clos", ordered by submission date. Open one → the detail screen shows its data; open its chat → the thread loads.

- [ ] **Step 5: Verify the back-office read path and the region filter**

Sign out, sign in as `bo@bike-eco.fr` / `password123`.
Expected: three sections ("à traiter" / "en cours" / "clos") across all companies. In Settings, set "Région gérée" to "Moitié Nord" → the dashboard narrows to NORTH dossiers **live**, with no reload. Set it back to "Toute la France" → all return.

- [ ] **Step 6: Verify liveness**

With the b2b dashboard open, edit a dossier's `status` directly in the Emulator UI (Firestore tab).
Expected: the card moves between sections **without touching the app** — proving a listener, not a fetch.

- [ ] **Step 7: Understand what this walkthrough does NOT prove**

**The emulator does not enforce composite indexes.** It serves any valid query and
never raises `FAILED_PRECONDITION`, so a green walkthrough is **no evidence** that
`firestore.indexes.json` is correct or complete. Only a real Firestore instance can
tell you that — in production, a query missing an index fails with an error carrying
a create-index link.

Do **not** add an "check for index errors" step here; it would report success
regardless. The Task 3 indexes are correct by construction (equality fields —
including `in` — precede the `orderBy` field), and are verified for real in Step 8.

- [ ] **Step 8: Deploy the indexes and verify against the live project (owner)**

This step deploys to the real project, so it needs the owner's go-ahead — it is the
only way to prove the index config. Rules are deployed alongside, since the live
database currently has none.

```sh
npx -y firebase-tools@latest deploy --only firestore:indexes --project bike-eco-43a84
```
Expected: the three `dossiers` indexes are created (building may take a few minutes
on a populated collection; it is instant on an empty one).

Then run the app **without** `EXPO_PUBLIC_USE_EMULATORS` against the live project and
open both dashboards. Expected: no `FAILED_PRECONDITION: The query requires an index`
in the Metro console. If one appears, it carries a create-index link — add the
matching entry to `firestore.indexes.json`, redeploy, and commit:

```sh
git add firestore.indexes.json
git commit -m "fix(data): add composite index required by the live dossier queries"
```

> **Deferring this is legitimate** — nothing else in the plan depends on it, and the
> emulator path stays green without it. But it must happen before any real user hits
> a dashboard, or every dossier query fails. If deferred, keep it on the Task 13 list.

---

# PHASE B — Writes (slice 3)

## Task 6: Storage paths + failure cleanup (TDD, pure)

**Files:**
- Create: `src/lib/storage/paths.ts`, `src/lib/storage/paths.test.ts`, `src/lib/storage/cleanup.ts`, `src/lib/storage/cleanup.test.ts`

**Interfaces:**
- Produces:
  - `dossierPhotoPath(companyId, dossierId, index, ext): string`
  - `dossierThumbnailPath(companyId, dossierId): string`
  - `messageAttachmentPath(companyId, dossierId, messageId, fileName): string`
  - `extensionForUri(uri: string): string`, `mimeForExtension(ext: string): string`, `sanitizeFileName(name: string): string`
  - `cleanUpOnFailure<R>(work: (track: (path: string) => void) => Promise<R>, remove: (path: string) => Promise<void>): Promise<R>`

- [ ] **Step 1: Write the failing path tests**

Create `src/lib/storage/paths.test.ts`:
```ts
import { expect, test } from "@jest/globals";
import {
  dossierPhotoPath,
  dossierThumbnailPath,
  extensionForUri,
  messageAttachmentPath,
  mimeForExtension,
  sanitizeFileName,
} from "./paths";

test("photo and thumbnail paths are keyed by company then dossier", () => {
  expect(dossierPhotoPath("comp_1", "dos_1", 2, "jpg")).toBe(
    "dossiers/comp_1/dos_1/photos/2.jpg",
  );
  expect(dossierThumbnailPath("comp_1", "dos_1")).toBe(
    "dossiers/comp_1/dos_1/photos/thumb.jpg",
  );
});

test("attachment paths nest under their message", () => {
  expect(messageAttachmentPath("comp_1", "dos_1", "msg_1", "offre.pdf")).toBe(
    "dossiers/comp_1/dos_1/messages/msg_1/offre.pdf",
  );
});

test("a file name cannot break out of its path segment", () => {
  expect(sanitizeFileName("../../etc/passwd")).toBe(".._.._etc_passwd");
  expect(sanitizeFileName("mon rapport (1).pdf")).toBe("mon_rapport__1_.pdf");
  expect(sanitizeFileName("")).toBe("fichier");
  expect(messageAttachmentPath("comp_1", "dos_1", "msg_1", "a/b.pdf")).toBe(
    "dossiers/comp_1/dos_1/messages/msg_1/a_b.pdf",
  );
});

test("extensions come from the uri, defaulting to jpg", () => {
  expect(extensionForUri("file:///tmp/IMG_0001.HEIC")).toBe("heic");
  expect(extensionForUri("file:///tmp/photo.png")).toBe("png");
  expect(extensionForUri("file:///tmp/photo.jpg?width=10")).toBe("jpg");
  expect(extensionForUri("file:///tmp/no-extension")).toBe("jpg");
  expect(extensionForUri("file:///tmp/weird.tiff")).toBe("jpg");
});

test("extensions map back to the content type Storage rules match on", () => {
  expect(mimeForExtension("jpg")).toBe("image/jpeg");
  expect(mimeForExtension("png")).toBe("image/png");
  expect(mimeForExtension("nope")).toBe("image/jpeg");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/lib/storage/paths.test.ts`
Expected: FAIL — `Cannot find module './paths'`.

- [ ] **Step 3: Implement `paths.ts`**

Create `src/lib/storage/paths.ts`:
```ts
/**
 * Storage layout for dossier files.
 *
 * Paths are keyed by company so Storage rules can authorize from claims alone:
 * Storage rules can only read Firestore's `(default)` database, and app data
 * lives in the named `bike-eco-db`. Back-office users have no `companyId` claim
 * and are allowed in by role instead.
 *
 * Pure — no `firebaseConfig` import, so it stays unit-testable.
 */

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
};

/** Content type for an uploaded photo; the Storage rule matches on this. */
export function mimeForExtension(ext: string): string {
  return MIME_BY_EXTENSION[ext.toLowerCase()] ?? "image/jpeg";
}

/**
 * PhotoPicker keeps only asset URIs, so the extension is all we have to go on.
 * Anything unrecognized is treated as JPEG — the picker's own default.
 */
export function extensionForUri(uri: string): string {
  const ext = /\.([A-Za-z0-9]+)(?:\?|#|$)/.exec(uri)?.[1]?.toLowerCase();
  return ext && ext in MIME_BY_EXTENSION ? ext : "jpg";
}

/** Keep a picked file's name inside one path segment. */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100);
  return cleaned.length > 0 ? cleaned : "fichier";
}

export function dossierPhotoPath(
  companyId: string,
  dossierId: string,
  index: number,
  ext: string,
): string {
  return `dossiers/${companyId}/${dossierId}/photos/${index}.${ext}`;
}

export function dossierThumbnailPath(
  companyId: string,
  dossierId: string,
): string {
  return `dossiers/${companyId}/${dossierId}/photos/thumb.jpg`;
}

export function messageAttachmentPath(
  companyId: string,
  dossierId: string,
  messageId: string,
  fileName: string,
): string {
  return `dossiers/${companyId}/${dossierId}/messages/${messageId}/${sanitizeFileName(fileName)}`;
}
```

- [ ] **Step 4: Run the path tests**

Run: `npx jest src/lib/storage/paths.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing cleanup tests**

Create `src/lib/storage/cleanup.test.ts`:
```ts
import { expect, jest, test } from "@jest/globals";
import { cleanUpOnFailure } from "./cleanup";

test("on success it returns the result and deletes nothing", async () => {
  const remove = jest.fn(async () => {});
  const result = await cleanUpOnFailure(async (track) => {
    track("dossiers/c/d/photos/0.jpg");
    return "dos_1";
  }, remove);

  expect(result).toBe("dos_1");
  expect(remove).not.toHaveBeenCalled();
});

test("a failure deletes everything already uploaded and rethrows", async () => {
  const removed: string[] = [];
  const remove = jest.fn(async (path: string) => void removed.push(path));
  const boom = new Error("upload failed");

  await expect(
    cleanUpOnFailure(async (track) => {
      track("dossiers/c/d/photos/0.jpg");
      track("dossiers/c/d/photos/1.jpg");
      throw boom;
    }, remove),
  ).rejects.toBe(boom);

  expect(removed).toEqual([
    "dossiers/c/d/photos/0.jpg",
    "dossiers/c/d/photos/1.jpg",
  ]);
});

test("a failed commit still cleans up its uploads", async () => {
  const removed: string[] = [];
  const remove = jest.fn(async (path: string) => void removed.push(path));

  // The dossier document is written last; if that write fails, the photos it
  // would have referenced must not survive.
  await expect(
    cleanUpOnFailure(async (track) => {
      track("dossiers/c/d/photos/thumb.jpg");
      throw Object.assign(new Error("denied"), { code: "permission-denied" });
    }, remove),
  ).rejects.toThrow("denied");

  expect(removed).toEqual(["dossiers/c/d/photos/thumb.jpg"]);
});

test("a cleanup that itself fails does not mask the original error", async () => {
  const original = new Error("original");
  const remove = jest.fn(async () => {
    throw new Error("delete failed");
  });

  await expect(
    cleanUpOnFailure(async (track) => {
      track("dossiers/c/d/photos/0.jpg");
      throw original;
    }, remove),
  ).rejects.toBe(original);

  // Without this, an implementation that never attempted cleanup would pass:
  // the rejection alone only re-proves the rethrow covered above.
  expect(remove).toHaveBeenCalledWith("dossiers/c/d/photos/0.jpg");
});
```

- [ ] **Step 6: Run them and watch them fail**

Run: `npx jest src/lib/storage/cleanup.test.ts`
Expected: FAIL — `Cannot find module './cleanup'`.

- [ ] **Step 7: Implement `cleanup.ts`**

Create `src/lib/storage/cleanup.ts`:
```ts
/**
 * Run `work`, deleting every path it reported to `track` if it throws.
 *
 * The dossier document is written last and inside `work`, so anything uploaded
 * before a failure — whether an upload or the final write — would be referenced
 * by nothing. Orphaned objects have no use-case and are not kept.
 *
 * Best-effort by nature: it cannot cover the app being killed mid-upload, where
 * this `catch` never runs.
 *
 * Cleanup failures are swallowed (`allSettled`) so the original error, which is
 * what the user needs to see, still surfaces.
 */
export async function cleanUpOnFailure<R>(
  work: (track: (path: string) => void) => Promise<R>,
  remove: (path: string) => Promise<void>,
): Promise<R> {
  const uploaded: string[] = [];
  try {
    return await work((path) => {
      uploaded.push(path);
    });
  } catch (error) {
    await Promise.allSettled(uploaded.map((path) => remove(path)));
    throw error;
  }
}
```

- [ ] **Step 8: Run the cleanup tests**

Run: `npx jest src/lib/storage/cleanup.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```sh
git add src/lib/storage/paths.ts src/lib/storage/paths.test.ts src/lib/storage/cleanup.ts src/lib/storage/cleanup.test.ts
git commit -m "feat(storage): company-keyed path layout + failed-upload cleanup"
```

---

## Task 7: Write rules for Firestore + Storage, with emulator tests

Activate the **firebase-firestore** and **firebase-security-rules-auditor** skills before editing rules, and audit the final `firestore.rules` with the auditor skill.

**Files:**
- Modify: `firestore.rules`, `storage.rules`, `src/lib/firestore/__tests__/rules.test.ts`, `jest.rules.config.js`, `package.json`
- Create: `src/lib/firestore/__tests__/storageRules.test.ts`

**Interfaces:**
- Consumes: claim shape `{ role, companyId, region, status }`; the Storage layout from Task 6.
- Produces: rules permitting exactly the writes Phase B performs; `npm run test:rules` covering Firestore **and** Storage.

- [ ] **Step 1: Add the write rules to `firestore.rules`**

Replace the whole file:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function claims()      { return request.auth.token; }
    function isSignedIn()  { return request.auth != null; }
    function isActive()    { return isSignedIn() && claims().status == 'active'; }
    function isBackoffice(){ return isActive() && claims().role == 'backoffice'; }
    function myCompany()   { return claims().companyId; }

    // Named helper so the messages `read` and `create` rules cannot drift apart.
    function isDossierParticipant(dossierId) {
      return isBackoffice()
        || (isActive()
            && get(/databases/$(database)/documents/dossiers/$(dossierId))
                 .data.companyId == myCompany());
    }

    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isBackoffice());
      // Owner edits profile fields only; role/companyId/region/status/createdAt
      // are server-set claims and must never be client-writable.
      allow update: if request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys()
             .hasAny(['role', 'companyId', 'region', 'status', 'createdAt']);
      allow create, delete: if false;
    }

    match /companies/{companyId} {
      allow read: if isBackoffice()
        || (isSignedIn() && myCompany() == companyId);
      allow write: if false;
    }

    match /dossiers/{dossierId} {
      allow read: if isBackoffice()
        || (isActive() && resource.data.companyId == myCompany());

      // A dealer may only file a dossier for their own company, as themselves,
      // as new work. `region` is client-derived from the submitter's département
      // and is reassignable by the back-office (page-dossier-management), so only
      // its domain is enforced here — a wrong value is a correctable routing
      // nuisance, not an access boundary.
      allow create: if isActive() && claims().role == 'b2b'
        && request.resource.data.companyId == myCompany()
        && request.resource.data.submittedBy == request.auth.uid
        && request.resource.data.status == 'a_traiter'
        && request.resource.data.negotiatedPrice == null
        && request.resource.data.region in ['NORTH', 'SOUTH'];

      // Exactly the fields DossierManagementForm submits — nothing more.
      allow update: if isBackoffice()
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['status', 'region', 'negotiatedPrice', 'updatedAt']);

      allow delete: if false;

      match /messages/{messageId} {
        allow read: if isDossierParticipant(dossierId);
        allow create: if isDossierParticipant(dossierId)
          && request.resource.data.senderId == request.auth.uid
          && request.resource.data.senderRole == claims().role;
        allow update, delete: if false;
      }
    }

    match /invitations/{invitationId} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 2: Open the dossier paths in `storage.rules`**

Replace the whole file:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function claims()      { return request.auth.token; }
    function isSignedIn()  { return request.auth != null; }
    function isActive()    { return isSignedIn() && claims().status == 'active'; }
    function isBackoffice(){ return isActive() && claims().role == 'backoffice'; }

    // Keyed by company because Storage rules can only reach Firestore's
    // `(default)` database, and app data lives in the named `bike-eco-db` —
    // so authorization has to come from claims alone. Back-office users carry no
    // companyId claim and are admitted by role.
    match /dossiers/{companyId}/{dossierId}/{allPaths=**} {
      function canAccess() {
        return isActive()
          && (isBackoffice() || claims().companyId == companyId);
      }

      allow read: if canAccess();

      allow write: if canAccess()
        && request.resource.size < 10 * 1024 * 1024
        && request.resource.contentType.matches('image/.*|application/pdf');

      // Lets a failed submission delete what it already uploaded. This grants no
      // new power: `write` above already covers overwriting an object at a known
      // path, so anyone who can upload can already replace what is there.
      // (`write` alone cannot authorize a delete — `request.resource` is null on
      // delete, so its size/contentType checks fail. Hence this separate rule.)
      allow delete: if canAccess();
    }
  }
}
```

- [ ] **Step 3: Extend the Firestore rules tests**

Replace `src/lib/firestore/__tests__/rules.test.ts` entirely:
```ts
import { afterAll, beforeAll, test } from "@jest/globals";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

let env: RulesTestEnvironment;

const b2bClaims = { role: "b2b", companyId: "comp_1", status: "active" };
const boClaims = { role: "backoffice", region: "NORTH", status: "active" };
const pendingClaims = { role: "b2b", companyId: "comp_1", status: "pending" };

/** Minimal dossier the create rule accepts; override to probe each clause. */
const newDossier = (overrides: Record<string, unknown> = {}) => ({
  status: "a_traiter",
  region: "NORTH",
  companyId: "comp_1",
  submittedBy: "user_b2b",
  negotiatedPrice: null,
  photos: [],
  thumbnailUrl: null,
  ...overrides,
});

const newMessage = (overrides: Record<string, unknown> = {}) => ({
  senderId: "user_b2b",
  senderName: "Camille Durand - Garage du Nord",
  senderRole: "b2b",
  text: "Bonjour",
  attachments: [],
  ...overrides,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "bike-eco-43a84",
    firestore: {
      rules: readFileSync(
        resolve(__dirname, "../../../../firestore.rules"),
        "utf8",
      ),
    },
  });
  // Seed docs bypassing rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "dossiers/dos_1"), {
      companyId: "comp_1",
      status: "a_traiter",
      region: "NORTH",
      negotiatedPrice: null,
    });
    await setDoc(doc(db, "dossiers/dos_2"), {
      companyId: "comp_2",
      status: "a_traiter",
      region: "SOUTH",
      negotiatedPrice: null,
    });
    await setDoc(doc(db, "users/user_b2b"), { nom: "Durand" });
  });
});

afterAll(async () => env.cleanup());

// ── reads ──────────────────────────────────────────────────────────────────

test("unauthenticated reads are denied", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "dossiers/dos_1")));
});

test("a b2b user reads only their company's dossiers", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "dossiers/dos_1")));
  await assertFails(getDoc(doc(db, "dossiers/dos_2")));
});

test("backoffice reads any dossier", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "dossiers/dos_2")));
});

test("owner cannot escalate their own claims fields", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertSucceeds(updateDoc(doc(db, "users/user_b2b"), { ville: "Lyon" }));
  await assertFails(updateDoc(doc(db, "users/user_b2b"), { role: "backoffice" }));
});

// ── dossier create ─────────────────────────────────────────────────────────

test("a dealer files a dossier for their own company", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertSucceeds(addDoc(collection(db, "dossiers"), newDossier()));
});

test("a dealer cannot file against another company", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ companyId: "comp_2" })),
  );
});

test("a dealer cannot file as someone else", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ submittedBy: "user_bo" })),
  );
});

test("a dossier cannot be born already in progress or priced", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ status: "en_cours" })),
  );
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ negotiatedPrice: 4200 })),
  );
});

test("region must be a real region", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ region: "EAST" })),
  );
});

test("a pending account cannot file anything", async () => {
  const db = env.authenticatedContext("user_pending", pendingClaims).firestore();
  await assertFails(addDoc(collection(db, "dossiers"), newDossier()));
});

test("backoffice does not file dossiers", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ companyId: "comp_1" })),
  );
});

// ── dossier update ─────────────────────────────────────────────────────────

test("backoffice updates status, region and negotiated price", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "dossiers/dos_1"), {
      status: "en_cours",
      region: "SOUTH",
      negotiatedPrice: 4200,
    }),
  );
});

test("backoffice cannot move a dossier between companies", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), { companyId: "comp_2" }),
  );
});

test("a dealer cannot update their own dossier", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), { negotiatedPrice: 99999 }),
  );
});

// ── messages ───────────────────────────────────────────────────────────────

test("a dealer messages on their own dossier", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertSucceeds(
    addDoc(collection(db, "dossiers/dos_1/messages"), newMessage()),
  );
});

test("a dealer cannot message on another company's dossier", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers/dos_2/messages"), newMessage()),
  );
});

test("a sender cannot impersonate someone else", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(
    addDoc(
      collection(db, "dossiers/dos_1/messages"),
      newMessage({ senderId: "user_bo" }),
    ),
  );
  await assertFails(
    addDoc(
      collection(db, "dossiers/dos_1/messages"),
      newMessage({ senderRole: "backoffice" }),
    ),
  );
});

test("backoffice messages on any dossier", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(
    addDoc(
      collection(db, "dossiers/dos_2/messages"),
      newMessage({ senderId: "bo_1", senderRole: "backoffice" }),
    ),
  );
});

test("messages are immutable once sent", async () => {
  let id = "";
  await env.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(
      collection(ctx.firestore(), "dossiers/dos_1/messages"),
      newMessage(),
    );
    id = ref.id;
  });
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(
    updateDoc(doc(db, `dossiers/dos_1/messages/${id}`), { text: "edited" }),
  );
});
```

- [ ] **Step 4: Write the Storage rules tests**

Create `src/lib/firestore/__tests__/storageRules.test.ts`:
```ts
import { afterAll, beforeAll, test } from "@jest/globals";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteObject, ref, uploadBytes } from "firebase/storage";

let env: RulesTestEnvironment;

const b2bClaims = { role: "b2b", companyId: "comp_1", status: "active" };
const boClaims = { role: "backoffice", region: "NORTH", status: "active" };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "bike-eco-43a84",
    storage: {
      rules: readFileSync(
        resolve(__dirname, "../../../../storage.rules"),
        "utf8",
      ),
    },
  });
});

afterAll(async () => env.cleanup());

test("unauthenticated uploads are denied", async () => {
  const storage = env.unauthenticatedContext().storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );
});

test("a dealer uploads into their own company's dossier path", async () => {
  const storage = env.authenticatedContext("user_b2b", b2bClaims).storage();
  await assertSucceeds(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );
});

test("a dealer cannot upload into another company's path", async () => {
  const storage = env.authenticatedContext("user_b2b", b2bClaims).storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_2/dos_9/photos/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );
});

test("backoffice attaches to any company's dossier", async () => {
  const storage = env.authenticatedContext("bo_1", boClaims).storage();
  await assertSucceeds(
    uploadBytes(
      ref(storage, "dossiers/comp_2/dos_9/messages/msg_1/offre.pdf"),
      jpeg,
      { contentType: "application/pdf" },
    ),
  );
});

test("only images and pdfs are accepted", async () => {
  const storage = env.authenticatedContext("user_b2b", b2bClaims).storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/x.html"), jpeg, {
      contentType: "text/html",
    }),
  );
});

test("oversized files are rejected", async () => {
  const storage = env.authenticatedContext("user_b2b", b2bClaims).storage();
  const tooBig = new Uint8Array(11 * 1024 * 1024);
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/big.jpg"), tooBig, {
      contentType: "image/jpeg",
    }),
  );
});

test("a dealer can delete their own upload (failed-submission cleanup)", async () => {
  const storage = env.authenticatedContext("user_b2b", b2bClaims).storage();
  const target = ref(storage, "dossiers/comp_1/dos_cleanup/photos/0.jpg");
  await assertSucceeds(uploadBytes(target, jpeg, { contentType: "image/jpeg" }));
  await assertSucceeds(deleteObject(target));
});

test("a dealer cannot delete another company's upload", async () => {
  const bo = env.authenticatedContext("bo_1", boClaims).storage();
  await assertSucceeds(
    uploadBytes(ref(bo, "dossiers/comp_2/dos_victim/photos/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );

  const attacker = env.authenticatedContext("user_b2b", b2bClaims).storage();
  await assertFails(
    deleteObject(ref(attacker, "dossiers/comp_2/dos_victim/photos/0.jpg")),
  );
});
```

- [ ] **Step 5: Point the rules Jest config at both suites**

In `jest.rules.config.js`, replace the `testMatch` line:
```js
  testMatch: ["<rootDir>/src/lib/firestore/__tests__/rules.test.ts"],
```
with:
```js
  testMatch: [
    "<rootDir>/src/lib/firestore/__tests__/rules.test.ts",
    "<rootDir>/src/lib/firestore/__tests__/storageRules.test.ts",
  ],
```

In `package.json`, add the new file to the main config's `testPathIgnorePatterns` so the jest-expo suite keeps skipping it:
```json
    "testPathIgnorePatterns": [
      "/node_modules/",
      "<rootDir>/src/lib/firestore/__tests__/rules.test.ts",
      "<rootDir>/src/lib/firestore/__tests__/storageRules.test.ts"
    ],
```

And widen the `test:rules` script to boot the Storage emulator and run both files:
```json
    "test:rules": "firebase emulators:exec --only firestore,storage --project bike-eco-43a84 \"jest --config jest.rules.config.js\"",
```

- [ ] **Step 6: Run the rules tests**

Run: `npm run test:rules`
Expected: PASS — both suites; the emulators boot, run, and tear down.
> If the Storage suite cannot reach the emulator, confirm `emulators:exec` is
> exporting `FIREBASE_STORAGE_EMULATOR_HOST`; `initializeTestEnvironment`
> discovers ports through the emulator hub that `emulators:exec` starts.

- [ ] **Step 7: Run the unit suite to confirm nothing leaked**

Run: `npx jest`
Expected: PASS, and the two rules suites are **not** collected (they're ignored).

- [ ] **Step 8: Audit the rules**

Activate the **firebase-security-rules-auditor** skill and audit `firestore.rules` + `storage.rules`. Fix anything it flags, then re-run `npm run test:rules`.

- [ ] **Step 9: Commit**

```sh
git add firestore.rules storage.rules jest.rules.config.js package.json src/lib/firestore/__tests__/rules.test.ts src/lib/firestore/__tests__/storageRules.test.ts
git commit -m "feat(security): claim-pinned dossier write rules + storage rules with emulator tests"
```

---

## Task 8: `toDossierPayload` — form → document (TDD, pure)

**Files:**
- Create: `src/features/b2b-submission/toDossier.ts`, `src/features/b2b-submission/__tests__/toDossier.test.ts`

**Interfaces:**
- Consumes: `B2bSubmissionForm` from `./schema`; `SessionUser` from `@/lib/auth/session` (= `WithId<AppUser>`, so it carries `id`, `nom`, `prenom`, `departement`, `companyId`, `role`); `isSud` from `@/constants/departments`.
- Produces:
  - `type DossierWrite = Omit<Dossier, "createdAt" | "updatedAt">`
  - `regionForDepartement(departement: string): Region`
  - `toDossierPayload(values, session, company: { id: string; name: string }, photos: { urls: string[]; thumbnailUrl: string | null }): DossierWrite`

Timestamps are deliberately excluded: `serverTimestamp()` would need a `firebase/firestore` import, which the jest-expo stub does not provide. Task 9's caller adds them.

- [ ] **Step 1: Write the failing test**

Create `src/features/b2b-submission/__tests__/toDossier.test.ts`:
```ts
import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import type { SessionUser } from "@/lib/auth/session";
import { B2B_SUBMISSION_DEFAULTS } from "../schema";
import { regionForDepartement, toDossierPayload } from "../toDossier";

const session: SessionUser = {
  id: "user_b2b",
  role: "b2b",
  companyId: "comp_nord",
  region: null,
  nom: "Durand",
  prenom: "Camille",
  email: "c@x.fr",
  telephone: "0600000000",
  departement: "75 - Paris",
  ville: "Paris",
  status: "active",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const company = { id: "comp_nord", name: "Garage du Nord" };
const photos = { urls: ["https://x/0.jpg"], thumbnailUrl: "https://x/t.jpg" };

test("région follows the submitter's département", () => {
  expect(regionForDepartement("75 - Paris")).toBe("NORTH");
  expect(regionForDepartement("13 - Bouches-du-Rhône")).toBe("SOUTH");
  expect(regionForDepartement("2A - Corse-du-Sud")).toBe("SOUTH");
  // Unknown départements fall back to NORTH, matching functions/src/regions.ts.
  expect(regionForDepartement("99 - Inconnu")).toBe("NORTH");
});

test("a new dossier is unstarted, unpriced, and owned by the submitter", () => {
  const d = toDossierPayload(
    B2B_SUBMISSION_DEFAULTS,
    session,
    company,
    photos,
  );
  expect(d.status).toBe("a_traiter");
  expect(d.negotiatedPrice).toBeNull();
  expect(d.companyId).toBe("comp_nord");
  expect(d.submittedBy).toBe("user_b2b");
  expect(d.region).toBe("NORTH");
  expect(d.submitter).toEqual({
    nom: "Durand",
    prenom: "Camille",
    companyName: "Garage du Nord",
  });
  expect(d.photos).toEqual(["https://x/0.jpg"]);
  expect(d.thumbnailUrl).toBe("https://x/t.jpg");
});

test("numeric strings are coerced and blanks become null", () => {
  const d = toDossierPayload(
    {
      ...B2B_SUBMISSION_DEFAULTS,
      annee: "2019",
      kilometrage: "18 450",
      prix: "5000",
      cleNoire: "2",
      telecommande: null,
    },
    session,
    company,
    photos,
  );
  expect(d.vehicle.annee).toBe(2019);
  expect(d.vehicle.kilometrage).toBe(18450);
  expect(d.pricing.prix).toBe(5000);
  expect(d.keys.cleNoire).toBe(2);
  expect(d.keys.telecommande).toBeNull();
  // The B2B funnel merges "Modèle et Cylindrée" into `modele`.
  expect(d.vehicle.cylindree).toBeNull();
});

test("free text is trimmed and oui/non answers are narrowed", () => {
  const d = toDossierPayload(
    {
      ...B2B_SUBMISSION_DEFAULTS,
      marque: "  Yamaha ",
      modele: " MT-07 ",
      accessoires: "  Top-case ",
      aClesContact: "oui",
      carteGrise: "non",
      etat: "Bon état",
      resultatCT: "Favorable",
    },
    session,
    company,
    photos,
  );
  expect(d.vehicle.marque).toBe("Yamaha");
  expect(d.vehicle.modele).toBe("MT-07");
  expect(d.vehicle.accessoires).toBe("Top-case");
  expect(d.keys.aClesContact).toBe("oui");
  expect(d.papers.carteGrise).toBe("non");
  expect(d.condition.etat).toBe("Bon état");
  expect(d.papers.resultatCT).toBe("Favorable");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/features/b2b-submission/__tests__/toDossier.test.ts`
Expected: FAIL — `Cannot find module '../toDossier'`.

- [ ] **Step 3: Implement `toDossier.ts`**

Create `src/features/b2b-submission/toDossier.ts`:
```ts
import { isSud } from "@/constants/departments";
import type { SessionUser } from "@/lib/auth/session";
import type {
  Dossier,
  EtatVehicule,
  OuiNon,
  Region,
  ResultatCT,
} from "@/lib/firestore/schema";
import type { B2bSubmissionForm } from "./schema";

/**
 * A dossier as the client writes it. Timestamps are the caller's job: they use
 * `serverTimestamp()`, and importing `firebase/firestore` here would break this
 * module's unit tests (the jest-expo config stubs that package).
 */
export type DossierWrite = Omit<Dossier, "createdAt" | "updatedAt">;

/** Blank/unparseable → null, so "not answered" stays distinct from 0. */
function toNumber(value: string | null): number | null {
  if (value == null || value.trim() === "") return null;
  const parsed = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(parsed) ? null : parsed;
}

function toOuiNon(value: string | null): OuiNon | null {
  return value === "oui" || value === "non" ? value : null;
}

/**
 * Which Bike-eco centre handles this dealer's département. Unknown codes fall
 * back to NORTH, matching `functions/src/regions.ts` for the B2C funnel.
 */
export function regionForDepartement(departement: string): Region {
  return isSud(departement) ? "SOUTH" : "NORTH";
}

/**
 * Map the "Vendre une moto" funnel onto a dossier document.
 *
 * Identity comes from the session, never the form: the create rule pins
 * `companyId`/`submittedBy` to the caller's claims, so anything else is rejected.
 */
export function toDossierPayload(
  values: B2bSubmissionForm,
  session: SessionUser,
  company: { id: string; name: string },
  photos: { urls: string[]; thumbnailUrl: string | null },
): DossierWrite {
  return {
    status: "a_traiter",
    region: regionForDepartement(session.departement),
    companyId: company.id,
    submittedBy: session.id,
    negotiatedPrice: null,
    submitter: {
      nom: session.nom,
      prenom: session.prenom,
      companyName: company.name,
    },
    vehicle: {
      electrique: toOuiNon(values.electrique) ?? "non",
      materiel: values.materiel,
      marque: values.marque.trim(),
      // The B2B funnel merges "Modèle et Cylindrée" into one field, so the
      // dossier's separate `cylindree` has no source here.
      modele: values.modele.trim(),
      cylindree: null,
      annee: toNumber(values.annee),
      kilometrage: toNumber(values.kilometrage),
      accessoires: values.accessoires.trim(),
    },
    keys: {
      aClesContact: toOuiNon(values.aClesContact),
      cleNoire: toNumber(values.cleNoire),
      cleMarron: toNumber(values.cleMarron),
      cleRouge: toNumber(values.cleRouge),
      aTelecommande: toOuiNon(values.aTelecommande),
      telecommande: toNumber(values.telecommande),
    },
    condition: {
      etat: (values.etat as EtatVehicule | null) ?? null,
      naturePanne: values.naturePanne.trim(),
    },
    papers: {
      carteGrise: toOuiNon(values.carteGrise),
      carteGriseAVotreNom: toOuiNon(values.carteGriseAVotreNom),
      controleTechnique: toOuiNon(values.controleTechnique),
      ctMoins6Mois: toOuiNon(values.ctMoins6Mois),
      resultatCT: (values.resultatCT as ResultatCT | null) ?? null,
      certificatNonGage: toOuiNon(values.certificatNonGage),
      carnetEntretien: toOuiNon(values.carnetEntretien),
      factureEntretien: toOuiNon(values.factureEntretien),
    },
    pricing: {
      prix: toNumber(values.prix),
      commentaires: values.commentaires.trim(),
    },
    photos: photos.urls,
    thumbnailUrl: photos.thumbnailUrl,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/features/b2b-submission/__tests__/toDossier.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```sh
git add src/features/b2b-submission/toDossier.ts src/features/b2b-submission/__tests__/toDossier.test.ts
git commit -m "feat(b2b): map the submission funnel onto a dossier document"
```

---

## Task 9: Real B2B submission — upload photos, write the dossier

**Files:**
- Create: `src/lib/storage/upload.ts`
- Modify: `src/features/b2b-submission/submit.ts`, `src/app/(b2b)/vehicule-submission.tsx`, `package.json`

**Interfaces:**
- Consumes: `cleanUpOnFailure` (Task 6); path helpers (Task 6); `toDossierPayload` (Task 8); `mapDataError` (Task 1); `companyDoc`/`dossiersRef` from `@/lib/firestore/collections`; `SessionUser` from `@/lib/auth/session`.
- Produces:
  - `uploadLocalFile(uri: string, path: string, contentType: string): Promise<string>` (download URL)
  - `removeStorageObject(path: string): Promise<void>`
  - `makeThumbnail(uri: string): Promise<string>` (local uri of a downscaled JPEG)
  - `submitB2bSubmission(values: B2bSubmissionForm, session: SessionUser): Promise<void>` — **signature change**: it now takes the session.

- [ ] **Step 1: Install the thumbnail dependency**

Run:
```sh
npx expo install expo-image-manipulator
```
Expected: added to `package.json` dependencies.

- [ ] **Step 2: Implement `upload.ts`**

Create `src/lib/storage/upload.ts`:
```ts
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import { storage } from "../../../firebaseConfig";

/** Card thumbnails render small; a camera photo is megabytes of wasted list. */
const THUMBNAIL_WIDTH = 400;

/**
 * Upload a local file URI and return its download URL.
 *
 * React Native has no `File`, so the URI is read through `fetch` into a Blob —
 * the standard path for the Firebase JS SDK on native.
 */
export async function uploadLocalFile(
  uri: string,
  path: string,
  contentType: string,
): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const target = storageRef(storage, path);
  await uploadBytes(target, blob, { contentType });
  return getDownloadURL(target);
}

export async function removeStorageObject(path: string): Promise<void> {
  await deleteObject(storageRef(storage, path));
}

/**
 * Downscale a photo for `Dossier.thumbnailUrl` ("low-res first photo").
 * SDK 56 API: `manipulateAsync` is deprecated in favour of this context form.
 */
export async function makeThumbnail(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: THUMBNAIL_WIDTH, height: null });
  const image = await context.renderAsync();
  const result = await image.saveAsync({
    compress: 0.6,
    format: SaveFormat.JPEG,
  });
  return result.uri;
}
```

- [ ] **Step 3: Rewrite `submit.ts`**

Replace `src/features/b2b-submission/submit.ts` entirely:
```ts
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import type { SessionUser } from "@/lib/auth/session";
import { mapDataError } from "@/lib/data/dataErrors";
import { companyDoc, dossiersRef } from "@/lib/firestore/collections";
import { cleanUpOnFailure } from "@/lib/storage/cleanup";
import {
  dossierPhotoPath,
  dossierThumbnailPath,
  extensionForUri,
  mimeForExtension,
} from "@/lib/storage/paths";
import {
  makeThumbnail,
  removeStorageObject,
  uploadLocalFile,
} from "@/lib/storage/upload";
import type { B2bSubmissionForm } from "./schema";
import { toDossierPayload } from "./toDossier";

/**
 * File a dossier for the signed-in dealer: mint an id, upload the photos under
 * it, then write the document last.
 *
 * Ordering matters. The id comes from `doc()` without a write, so photos can be
 * stored under their final path before anything references them; the document is
 * written last so a failed upload can never leave a dossier pointing at photos
 * that do not exist. `cleanUpOnFailure` deletes whatever landed if any step —
 * including that final write — throws.
 */
export async function submitB2bSubmission(
  values: B2bSubmissionForm,
  session: SessionUser,
): Promise<void> {
  const companyId = session.companyId;
  if (!companyId) {
    throw new Error("Aucune société n'est associée à votre compte.");
  }

  const ref = doc(dossiersRef);

  try {
    const companySnap = await getDoc(companyDoc(companyId));
    const companyName = companySnap.data()?.name ?? "";

    await cleanUpOnFailure(async (track) => {
      const thumbPath = dossierThumbnailPath(companyId, ref.id);
      const thumbnailUrl = await uploadLocalFile(
        await makeThumbnail(values.photos[0]),
        thumbPath,
        "image/jpeg",
      );
      track(thumbPath);

      const urls: string[] = [];
      for (const [index, uri] of values.photos.entries()) {
        const ext = extensionForUri(uri);
        const path = dossierPhotoPath(companyId, ref.id, index, ext);
        urls.push(await uploadLocalFile(uri, path, mimeForExtension(ext)));
        track(path);
      }

      await setDoc(ref, {
        ...toDossierPayload(
          values,
          session,
          { id: companyId, name: companyName },
          { urls, thumbnailUrl },
        ),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }, removeStorageObject);
  } catch (error) {
    throw new Error(mapDataError((error as { code?: string }).code ?? ""));
  }
}
```
> `values.photos` is guaranteed non-empty: `b2bSubmissionSchema` requires
> `.min(1, "Ajoutez au moins 1 photo du véhicule")`, so `photos[0]` is safe.

- [ ] **Step 4: Pass the session at the call site**

In `src/app/(b2b)/vehicule-submission.tsx`, add the import:
```ts
import { useSession } from "@/lib/data/useSession";
```
Add the hook inside the component, above `useStepForm`:
```ts
  const { user } = useSession();
```
Then change the submit body from:
```ts
        try {
          await submitB2bSubmission(values);
          setSubmitted(true);
```
to:
```ts
        try {
          if (!user) throw new Error("Votre session a expiré. Reconnectez-vous.");
          await submitB2bSubmission(values, user);
          setSubmitted(true);
```
The existing `catch` already surfaces `err.message` through `Alert.alert("Envoi impossible", …)`, and every error thrown above is French copy from `mapDataError`.

- [ ] **Step 5: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: clean.

- [ ] **Step 6: Commit**

```sh
git add src/lib/storage/upload.ts src/features/b2b-submission/submit.ts "src/app/(b2b)/vehicule-submission.tsx" package.json package-lock.json
git commit -m "feat(b2b): real dossier submission with photo upload and cleanup"
```

---

## Task 10: Split `useDossierMutations` into focused hooks

Today every call site imports all three concerns to use one.

**Files:**
- Create: `src/lib/data/useDossierManagement.ts`, `src/lib/data/useInvite.ts`
- Modify: `src/app/(backoffice)/dossier/[id]/management.tsx`, `src/app/(b2b)/add-colleague.tsx`
- Delete: `src/lib/data/useDossierMutations.ts`

**Interfaces:**
- Consumes: `mapDataError` (Task 1); `dossierDoc` from `@/lib/firestore/collections`.
- Produces:
  - `useDossierManagement(): { updateManagement(id: string, region: Region, status: DossierStatus, price: number | null): Promise<void> }`
  - `useInvite(): { invite(email: string): Promise<void> }` — still stubbed (slice 4).
  - (`useSendMessage` arrives in Task 11.)

- [ ] **Step 1: Create `useDossierManagement.ts`**

```ts
import { useCallback } from "react";
import { serverTimestamp, updateDoc } from "firebase/firestore";

import { dossierDoc } from "@/lib/firestore/collections";
import type { DossierStatus, Region } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/**
 * Back-office status / région / prix négocié update (page-dossier-management).
 * These four fields are exactly what the update rule allows.
 */
export function useDossierManagement() {
  const updateManagement = useCallback(
    async (
      id: string,
      region: Region,
      status: DossierStatus,
      price: number | null,
    ) => {
      try {
        await updateDoc(dossierDoc(id), {
          region,
          status,
          negotiatedPrice: price,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        throw new Error(mapDataError((error as { code?: string }).code ?? ""));
      }
    },
    [],
  );

  return { updateManagement };
}
```

- [ ] **Step 2: Create `useInvite.ts`**

```ts
import { useCallback } from "react";

/**
 * STUB — colleague invitations need a Cloud Function to create the Auth user and
 * set its claims, which is slice 4. Kept as a hook so the call site does not
 * change when it lands.
 */
export function useInvite() {
  const invite = useCallback(async (email: string) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (__DEV__) console.log("[stub] invite", { email });
  }, []);

  return { invite };
}
```

- [ ] **Step 3: Repoint the management screen**

In `src/app/(backoffice)/dossier/[id]/management.tsx`, change:
```ts
import { useDossierMutations } from "@/lib/data/useDossierMutations";
```
to:
```ts
import { useDossierManagement } from "@/lib/data/useDossierManagement";
```
and:
```ts
  const { updateManagement } = useDossierMutations();
```
to:
```ts
  const { updateManagement } = useDossierManagement();
```
The screen's existing `catch` shows a French `Alert`; `updateManagement` now throws French copy from `mapDataError`, so surface it — change the catch from:
```tsx
            } catch {
              Alert.alert(
                "Erreur",
                "La mise à jour n'a pas pu être enregistrée. Veuillez réessayer."
              );
            }
```
to:
```tsx
            } catch (err) {
              Alert.alert(
                "Erreur",
                err instanceof Error
                  ? err.message
                  : "La mise à jour n'a pas pu être enregistrée. Veuillez réessayer."
              );
            }
```

- [ ] **Step 4: Repoint the invite screen**

In `src/app/(b2b)/add-colleague.tsx`, change:
```ts
import { useDossierMutations } from "@/lib/data/useDossierMutations";
```
to:
```ts
import { useInvite } from "@/lib/data/useInvite";
```
and:
```ts
  const { invite } = useDossierMutations();
```
to:
```ts
  const { invite } = useInvite();
```

- [ ] **Step 5: Delete the grab-bag hook**

```sh
git rm src/lib/data/useDossierMutations.ts
```
> Its `sendMessage` moves to `useSendMessage` in Task 11. If `tsc` complains that
> `DossierChatScreen` still imports `useDossierMutations`, leave it failing and
> complete Task 11 — or do Steps 1–4 of Task 11 first.

- [ ] **Step 6: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: the only remaining error is `DossierChatScreen`'s `sendMessage` import, which Task 11 resolves. Everything else clean.

- [ ] **Step 7: Commit**

```sh
git add -A src/lib/data "src/app/(backoffice)/dossier/[id]/management.tsx" "src/app/(b2b)/add-colleague.tsx"
git commit -m "refactor(data): split useDossierMutations into focused hooks"
```

---

## Task 11: Chat sending — `formatSenderName` + `useSendMessage`

**Files:**
- Create: `src/lib/chat/senderName.ts`, `src/lib/chat/senderName.test.ts`, `src/lib/data/useSendMessage.ts`
- Modify: `src/components/screens/DossierChatScreen.tsx`

**Interfaces:**
- Consumes: `cleanUpOnFailure` + paths (Task 6); `mapDataError` (Task 1); `messagesRef` from `@/lib/firestore/collections`; `useDossier`/`useMessages` (Tasks 3–4).
- Produces:
  - `formatSenderName(user: SessionUser, companyName: string): string`
  - `useSendMessage(dossierId: string, companyId: string, sender: { id: string; name: string; role: UserRole }): { send(text: string, files?: PickedFile[]): Promise<void> }`
  - `interface PickedFile { uri: string; name: string; size: number; mimeType: string; type: AttachmentType }`

- [ ] **Step 1: Write the failing sender-name test**

Create `src/lib/chat/senderName.test.ts`:
```ts
import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import type { SessionUser } from "@/lib/auth/session";
import { formatSenderName } from "./senderName";

const base: SessionUser = {
  id: "u1",
  role: "b2b",
  companyId: "comp_nord",
  region: null,
  nom: "Durand",
  prenom: "Camille",
  email: "c@x.fr",
  telephone: "0600000000",
  departement: "75 - Paris",
  ville: "Paris",
  status: "active",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

test("a dealer is labelled with their company", () => {
  expect(formatSenderName(base, "Garage du Nord")).toBe(
    "Camille Durand - Garage du Nord",
  );
});

test("the team is always labelled Bike-eco, never a company", () => {
  const bo: SessionUser = {
    ...base,
    role: "backoffice",
    companyId: null,
    region: "NORTH",
    nom: "Martin",
    prenom: "Alex",
  };
  expect(formatSenderName(bo, "Garage du Nord")).toBe("Alex Martin - Bike-eco");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/lib/chat/senderName.test.ts`
Expected: FAIL — `Cannot find module './senderName'`.

- [ ] **Step 3: Implement `senderName.ts`**

Create `src/lib/chat/senderName.ts`:
```ts
import type { SessionUser } from "@/lib/auth/session";

/**
 * The denormalized `Message.senderName`: "[prénom nom] - [société]" for a dealer,
 * "[prénom nom] - Bike-eco" for the team (page-chat.md).
 */
export function formatSenderName(
  user: SessionUser,
  companyName: string,
): string {
  const person = `${user.prenom} ${user.nom}`.trim();
  return user.role === "backoffice"
    ? `${person} - Bike-eco`
    : `${person} - ${companyName}`;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/lib/chat/senderName.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Create `useSendMessage.ts`**

```ts
import { useCallback } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { messagesRef } from "@/lib/firestore/collections";
import type {
  AttachmentType,
  MessageAttachment,
  UserRole,
} from "@/lib/firestore/schema";
import { cleanUpOnFailure } from "@/lib/storage/cleanup";
import { messageAttachmentPath, sanitizeFileName } from "@/lib/storage/paths";
import { removeStorageObject, uploadLocalFile } from "@/lib/storage/upload";
import { mapDataError } from "./dataErrors";

/** A file chosen in the composer, before it is uploaded. */
export interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
  type: AttachmentType;
}

/**
 * Send a message on a dossier.
 *
 * The message id is minted up front so attachments can be stored under it before
 * the document exists; the document is written last, and a failure deletes any
 * attachment already uploaded — same contract as dossier submission.
 */
export function useSendMessage(
  dossierId: string,
  companyId: string,
  sender: { id: string; name: string; role: UserRole },
) {
  const { id: senderId, name: senderName, role: senderRole } = sender;

  const send = useCallback(
    async (text: string, files: PickedFile[] = []) => {
      const ref = doc(messagesRef(dossierId));
      try {
        await cleanUpOnFailure(async (track) => {
          const attachments: MessageAttachment[] = [];
          for (const file of files) {
            const path = messageAttachmentPath(
              companyId,
              dossierId,
              ref.id,
              file.name,
            );
            const url = await uploadLocalFile(file.uri, path, file.mimeType);
            track(path);
            attachments.push({
              type: file.type,
              url,
              name: sanitizeFileName(file.name),
              size: file.size,
            });
          }

          await setDoc(ref, {
            senderId,
            senderName,
            senderRole,
            text: text.trim(),
            attachments,
            createdAt: serverTimestamp(),
          });
        }, removeStorageObject);
      } catch (error) {
        throw new Error(mapDataError((error as { code?: string }).code ?? ""));
      }
    },
    [dossierId, companyId, senderId, senderName, senderRole],
  );

  return { send };
}
```

- [ ] **Step 6: Rewire `DossierChatScreen`**

Replace `src/components/screens/DossierChatScreen.tsx` entirely:
```tsx
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import ChatComposer from "@/components/ui/chat/ChatComposer";
import ChatThread from "@/components/ui/chat/ChatThread";
import { formatSenderName } from "@/lib/chat/senderName";
import { useDossier } from "@/lib/data/useDossier";
import { useMessages } from "@/lib/data/useMessages";
import { useSendMessage } from "@/lib/data/useSendMessage";
import { useSession } from "@/lib/data/useSession";

export default function DossierChatScreen({ id }: { id: string }) {
  const { data: messages } = useMessages(id);
  // The dossier carries the company the thread belongs to: it keys the
  // attachment path, and its name labels a dealer's messages.
  const { data: dossier } = useDossier(id);
  const { user } = useSession();

  const { send } = useSendMessage(id, dossier?.companyId ?? "", {
    id: user?.id ?? "",
    name:
      user && dossier
        ? formatSenderName(user, dossier.submitter.companyName)
        : "",
    role: user?.role ?? "b2b",
  });

  if (!user || !dossier) return null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.flex}>
        <ChatThread messages={messages} currentUserId={user.id} />
        <ChatComposer
          onSend={(text) => {
            send(text).catch((err: Error) =>
              Alert.alert("Envoi impossible", err.message),
            );
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
```
> Hooks run before the `if (!user || !dossier) return null` guard so their order
> stays stable across renders — the placeholder values are never used, because
> the guard blocks the UI that could call `send`.

- [ ] **Step 7: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: all clean — this also clears Task 10's known `useDossierMutations` error.

- [ ] **Step 8: Commit**

```sh
git add src/lib/chat src/lib/data/useSendMessage.ts src/components/screens/DossierChatScreen.tsx
git commit -m "feat(chat): send messages to Firestore with a claim-pinned sender"
```

---

## Task 12: Chat attachments — wire the Photo/PDF sheet

`ChatThread` already renders attachments (file icon + name); only picking and uploading are missing.

**Files:**
- Modify: `src/components/ui/chat/ChatComposer.tsx`, `src/components/screens/DossierChatScreen.tsx`, `package.json`

**Interfaces:**
- Consumes: `PickedFile` and `useSendMessage(...).send(text, files)` (Task 11).
- Produces: `ChatComposer` prop becomes `onSend: (text: string, files: PickedFile[]) => void`.

- [ ] **Step 1: Install the document picker**

Run:
```sh
npx expo install expo-document-picker
```
Expected: added to `package.json` dependencies. (No config plugin is needed — the iCloud options are only for iCloud storage, which this does not use.)

- [ ] **Step 2: Rewrite `ChatComposer.tsx`**

Replace the whole file:
```tsx
import { BottomSheet, Button, Host } from "@expo/ui";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PickedFile } from "@/lib/data/useSendMessage";
import { tokens } from "@/theme/tokens";

export default function ChatComposer({
  onSend,
}: {
  onSend: (text: string, files: PickedFile[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const send = () => {
    const t = text.trim();
    if (!t && files.length === 0) return;
    onSend(t, files);
    setText("");
    setFiles([]);
  };

  async function pickPhoto() {
    setSheetOpen(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "L'accès à la galerie est nécessaire.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFiles((current) => [
      ...current,
      {
        uri: asset.uri,
        name: asset.fileName ?? "photo.jpg",
        size: asset.fileSize ?? 0,
        mimeType: asset.mimeType ?? "image/jpeg",
        type: "image",
      },
    ]);
  }

  async function pickPdf() {
    setSheetOpen(false);
    // `copyToCacheDirectory` so the file is readable straight away.
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFiles((current) => [
      ...current,
      {
        uri: asset.uri,
        name: asset.name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? "application/pdf",
        type: "pdf",
      },
    ]);
  }

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + tokens.space.sm }]}>
      {files.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pending}
        >
          {files.map((file, index) => (
            <TouchableOpacity
              key={`${file.uri}-${index}`}
              style={styles.chip}
              onPress={() =>
                setFiles((current) => current.filter((_, i) => i !== index))
              }
              accessibilityLabel={`Retirer ${file.name}`}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {file.type === "pdf" ? "📄" : "🖼️"} {file.name} ✕
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.row}>
        <TouchableOpacity
          style={styles.plus}
          onPress={() => setSheetOpen(true)}
          accessibilityLabel="Ajouter une pièce jointe"
        >
          <Text style={styles.plusText}>＋</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Votre message"
          placeholderTextColor={tokens.colors.muted}
          multiline
        />
        <TouchableOpacity style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Envoyer</Text>
        </TouchableOpacity>
      </View>

      <Host style={styles.sheetHost}>
        <BottomSheet isPresented={sheetOpen} onDismiss={() => setSheetOpen(false)}>
          <Button label="Photo" onPress={pickPhoto} />
          <Button label="PDF" onPress={pickPdf} />
        </BottomSheet>
      </Host>
    </View>
  );
}
```
Keep the file's existing `StyleSheet.create({...})` block as-is and add these three entries to it (the composer's controls moved into a `row`, and pending files need chips):
```ts
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: tokens.space.sm,
  },
  pending: {
    gap: tokens.space.sm,
    paddingBottom: tokens.space.sm,
  },
  chip: {
    maxWidth: 200,
    paddingHorizontal: tokens.space.sm,
    paddingVertical: 6,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.surfaceAlt,
  },
  chipText: { fontSize: 12, color: tokens.colors.primary },
```
Then remove `flexDirection: "row"` and `alignItems: "flex-end"` from the existing `bar` style — it is now a column wrapping the chips above the row.

- [ ] **Step 3: Pass the picked files through**

In `src/components/screens/DossierChatScreen.tsx`, change the composer usage from:
```tsx
        <ChatComposer
          onSend={(text) => {
            send(text).catch((err: Error) =>
              Alert.alert("Envoi impossible", err.message),
            );
          }}
        />
```
to:
```tsx
        <ChatComposer
          onSend={(text, files) => {
            send(text, files).catch((err: Error) =>
              Alert.alert("Envoi impossible", err.message),
            );
          }}
        />
```

- [ ] **Step 4: Typecheck, lint, test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: clean.

- [ ] **Step 5: Commit**

```sh
git add src/components/ui/chat/ChatComposer.tsx src/components/screens/DossierChatScreen.tsx package.json package-lock.json
git commit -m "feat(chat): photo and pdf attachments via Storage"
```

---

## Task 13: Phase B verification walkthrough + final checks

**Files:**
- Modify: `scripts/seed.ts` (seed a second company + messages so the walkthrough has something to compare against)

- [ ] **Step 1: Seed a second company and a chat thread**

In `scripts/seed.ts`, add before the `console.log`:
```ts
  // A second company so cross-company isolation is checkable by hand.
  await db.doc(`companies/comp_sud`).set({
    siret: "98765432100022",
    name: "Garage du Sud",
    status: "active",
    createdBy: "user_b2b_sud",
    createdAt: now,
  });
  await upsertUser("user_b2b_sud", "b2b@garage-sud.fr", "password123", {
    role: "b2b",
    companyId: "comp_sud",
    status: "active",
  });
  await db.doc(`users/user_b2b_sud`).set({
    role: "b2b", companyId: "comp_sud", region: null,
    nom: "Blanc", prenom: "Dominique", email: "b2b@garage-sud.fr",
    telephone: "0621222324", departement: "13 - Bouches-du-Rhône",
    ville: "Marseille", status: "active", createdAt: now, updatedAt: now,
  });
  await db.doc(`dossiers/dos_sud`).set({
    status: "a_traiter", region: "SOUTH", companyId: "comp_sud",
    submittedBy: "user_b2b_sud", negotiatedPrice: null,
    submitter: { nom: "Blanc", prenom: "Dominique", companyName: "Garage du Sud" },
    vehicle: {
      electrique: "non", materiel: [], marque: "Ducati", modele: "Monster",
      cylindree: 937, annee: 2021, kilometrage: 9200, accessoires: "",
    },
    keys: { aClesContact: "oui", cleNoire: 1, cleMarron: 0, cleRouge: 0, aTelecommande: "non", telecommande: null },
    condition: { etat: "Bon état", naturePanne: "" },
    papers: {
      carteGrise: "oui", carteGriseAVotreNom: "oui", controleTechnique: "oui",
      ctMoins6Mois: "oui", resultatCT: "Favorable", certificatNonGage: "oui",
      carnetEntretien: "oui", factureEntretien: "non",
    },
    pricing: { prix: 7000, commentaires: "" },
    photos: [], thumbnailUrl: null,
    createdAt: now, updatedAt: now,
  });

  await db.doc(`dossiers/dos_1/messages/msg_1`).set({
    senderId: "user_b2b",
    senderName: "Camille Durand - Garage du Nord",
    senderRole: "b2b",
    text: "Bonjour, la moto est disponible immédiatement.",
    attachments: [],
    createdAt: now,
  });
```
Update the final log line to:
```ts
  console.log(
    "Seed complete: user_b2b / user_b2b_sud / user_bo / user_pending (password123).",
  );
```

- [ ] **Step 2: Re-seed and confirm idempotency**

With the emulators running (`npx -y firebase-tools@latest emulators:start --only auth,firestore,storage --project bike-eco-43a84`):
Run `npm run seed` twice.
Expected: the new success line both times, no "already exists" crash.

- [ ] **Step 3: Verify submission end to end**

Run: `EXPO_PUBLIC_USE_EMULATORS=1 npx expo start`. Sign in as `b2b@garage-nord.fr`, tap "Vendre une moto", complete the funnel with at least one photo.
Expected: the confirmation screen; a new dossier appears on the dashboard **live**; its card shows the thumbnail. In the Emulator UI: the document has `status: "a_traiter"`, the correct `companyId`/`submittedBy`, `region: "NORTH"` (from the 75 département), and `photos`/`thumbnailUrl` URLs. Under Storage: `dossiers/comp_nord/<id>/photos/0.jpg` and `thumb.jpg`.

- [ ] **Step 4: Verify the failed-submission cleanup leaves nothing behind**

Stop the **Firestore** emulator only (leave Storage running), then submit again.
Expected: the "Envoi impossible" alert with French copy, and — the point of the test — **no leftover objects** under `dossiers/comp_nord/<new-id>/` in the Storage emulator: the photos uploaded before the failed document write are deleted. Restart Firestore afterwards.

- [ ] **Step 5: Verify back-office management**

Sign in as `bo@bike-eco.fr`, open a dossier → "Gestion", change status/région/prix, "Mettre à jour".
Expected: the confirmation screen; the b2b dashboard (other device/reload) reflects the new status live; `negotiatedPrice` is set in the Emulator UI.

- [ ] **Step 6: Verify chat both ways, with attachments**

As the back-office user, open a dossier's chat, attach a PDF, send. Then sign in as `b2b@garage-nord.fr` and open the same dossier's chat.
Expected: the message appears live on both sides; the sender reads "Alex Martin - Bike-eco"; the attachment renders with a file icon and its name; the b2b user's own replies read "Camille Durand - Garage du Nord". In Storage: `dossiers/comp_nord/<dossierId>/messages/<messageId>/<file>.pdf`.

- [ ] **Step 7: Verify the rules actually enforce isolation**

Signed in as `b2b@garage-nord.fr`, open the app's JS console and attempt a cross-company read:
```js
// Should be rejected by the rules, not merely hidden by the UI.
firebase.firestore().doc("dossiers/dos_sud").get()
```
Expected: `permission-denied`. The dashboard also never lists `dos_sud`.

- [ ] **Step 8: Full green sweep**

Run:
```sh
npx tsc --noEmit && npm run lint && npx jest && npm run test:rules
```
Expected: all four clean.

- [ ] **Step 9: Commit**

```sh
git add scripts/seed.ts
git commit -m "chore(dev): seed a second company and a chat thread for walkthroughs"
```

---

## Final verification (whole plan)

- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run lint` — clean.
- [ ] `npx jest` — pure suites pass (dataErrors, paths, cleanup, toDossier, senderName, plus the existing auth/schema/tokens suites).
- [ ] `npm run test:rules` — Firestore + Storage rules suites pass.
- [ ] `git grep -n "fixtures\|MOCK_DOSSIERS\|useDossierMutations\|lastMessageAt\|assignedTo" -- src scripts` returns nothing.
- [ ] Phase A walkthrough (Task 5) and Phase B walkthrough (Task 13) both observed.

### Before this ships to real users (owner-gated, deploys to production)

Everything above is emulator-only: **none of it touches the live project**, and a
green run proves nothing about production. As of 2026-07-16 the live project has
**no active Firestore rules** (slice 1 only ever dry-ran the deploy) and no indexes,
so both must land before anyone signs in for real:

- [ ] Confirm in the console whether `bike-eco-db` currently has any ruleset. A
      database left on its creation-mode default is either deny-all (harmless) or
      open-until-a-date (**not** harmless — anyone with the public API key can read
      every dossier). The MCP reports rules for the *default* instance, not the named
      one, so this needs human eyes.
- [ ] `npx -y firebase-tools@latest deploy --only firestore:rules,storage:rules,firestore:indexes --project bike-eco-43a84`
- [ ] Re-run the Phase A + B walkthroughs against the live project (no
      `EXPO_PUBLIC_USE_EMULATORS`) to confirm the indexes cover every query — the
      only way to verify them, since the emulator ignores composite indexes entirely.

## Self-review notes (author)

- **Spec coverage:** Phase A reads → Tasks 3–4 (+ indexes in 3); `mapDataError` → Task 1; Decision 5 field deletion → Task 2; deletions of `filter.ts`/`fixtures.ts` → Task 4; Storage layout + Decision 9 cleanup → Tasks 6, 9; rules (Firestore + Storage, Decision 6/7) → Task 7; submission → Tasks 8–9; hook split → Task 10; sender name + chat → Task 11; attachments (Decision 3) → Task 12; thumbnails (Decision 8) → Task 9; seed/verification → Tasks 5, 13.
- **Type consistency:** `mapDataError(code: string): string`, `cleanUpOnFailure(work, remove)`, `PickedFile`, `DossierWrite`, `toDossierPayload(values, session, company, photos)`, `formatSenderName(user, companyName)`, `useSendMessage(dossierId, companyId, sender)`, `useDossierManagement()`, `useInvite()` are used with identical signatures wherever referenced.
- **Deviation from the spec, deliberate:** the spec described the cleanup test as an emulator test stubbing `setDoc` into failure. That is not reachable — `submit.ts` imports `firebaseConfig`, which pulls AsyncStorage/`initializeAuth` and cannot load in the rules tests' node environment. Task 6 instead proves the same behaviour ("no orphans", including on a failed final write) as a hermetic unit test of `cleanUpOnFailure` with injected fakes, and Task 13 Step 4 observes it for real against the emulators. The spec's Testing section is updated to match.
- **Known-blocking edge:** Task 10 Step 5 deliberately leaves `tsc` failing on `DossierChatScreen` until Task 11 lands; both tasks are in the same phase and the plan says so at both ends.
- **Verified against the codebase:** `isNord`/`isSud` (not English names) are the real exports; `ChatThread` already renders attachments; `MOCK_COMPANIES`/`MOCK_USERS` are already dead; the jest-expo `firebase/firestore` mock exports only `Timestamp`/`getFirestore`/`connectFirestoreEmulator`; `b2bSubmissionSchema` guarantees ≥1 photo; `firebase.json` already has the firestore/storage/emulator sections.
