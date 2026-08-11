# Delete Dossier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a back-office user permanently delete a dossier along with its messages, mutes and Storage files, from the bottom of the "Statut dossier" tab.

**Architecture:** A new `deleteDossier` callable Cloud Function mirrors the existing `deleteCompany`: it asserts the caller is an active back-office member, reads the dossier for its `companyId`, deletes the Storage prefix `dossiers/{companyId}/{dossierId}/`, then `recursiveDelete`s the Firestore document (sweeping `messages/**` and `mutes/**`). The client adds a danger button + `ConfirmModal` to the management screen and redirects through the existing confirmation route to the dashboard.

**Tech Stack:** Firebase Cloud Functions v2 (`onCall` via the repo's `authedCall` wrapper), firebase-admin, Zod v4, Jest + ts-jest (functions), React Native / Expo Router (client).

## Global Constraints

- All user-facing copy is French. Exact strings, verbatim:
  - Button label: `Supprimer ce dossier`
  - Modal title: `Supprimer ce dossier ?`
  - Modal message: `Cette action supprime définitivement le dossier, ses conversations et ses documents associés.`
  - Modal cancel: `Annuler` (already hardcoded in `ConfirmModal`)
  - Section title: `Gérer ce dossier`
  - Confirmation title: `Dossier supprimé`
  - Confirmation message: `Le dossier a bien été supprimé.`
  - Permission error: `Action réservée à l'équipe Bike-eco.`
  - Not-found error: `Dossier introuvable.`
  - Error alert title: `Suppression impossible`
- Server errors are thrown as `RegError(code, frenchMessage)` from `functions/src/errors.ts`. Never `HttpsError` directly in a core module.
- Cloud Function cores and schemas are unit-tested; callable wiring in `index.ts` is not. Screens and components are not unit-tested — they are gated by `tsc` + lint. (`docs/tech/verification.md`)
- Import jest globals explicitly in test files: `import { describe, expect, test } from "@jest/globals";`
- Functions tests run from the `functions/` directory with `npx jest`. Client tests run from the repo root with `npm test`.
- The repo-root gate is `npx tsc --noEmit && npx expo lint && npm test`. All three must be green.
- Do NOT loosen `firestore.rules` or `storage.rules`. `dossiers/{id}` stays at `allow delete: if false` and its `messages` subcollection stays at `allow create, update, delete: if false`. The Admin SDK bypasses rules.
- Storage deletion is by prefix only. Never enumerate files client-side.
- `deleteStorage` runs BEFORE the Firestore delete. This ordering is load-bearing — see Task 2.

---

### Task 1: Share `assertBackoffice` from `errors.ts`

`assertBackoffice` is currently a private function in `functions/src/registration/backoffice.ts`. The new dossiers module needs the same check. Move it to `functions/src/errors.ts`, where its two dependencies (`RegError`, `CallerClaims`) already live, so the dossiers module does not have to import from the registration feature.

This is a pure move: same logic, same French copy, no behaviour change. The existing `registration/backoffice.test.ts` continues to cover it through `approveCompanyCore` / `deleteCompanyCore`.

**Files:**
- Modify: `functions/src/errors.ts` (append the function)
- Modify: `functions/src/registration/backoffice.ts:1-22` (delete the local definition, import instead)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `assertBackoffice(caller: CallerClaims): void` exported from `functions/src/errors.ts`. Throws `RegError("permission-denied", "Action réservée à l'équipe Bike-eco.")` when `caller.role !== "backoffice"` or `caller.status !== "active"`. Task 2 imports it.

- [ ] **Step 1: Run the existing functions tests to confirm a green starting point**

```bash
cd functions && npx jest src/registration/backoffice.test.ts
```

Expected: PASS. If this is already failing, stop and report — the rest of the plan assumes a green baseline.

- [ ] **Step 2: Append `assertBackoffice` to `functions/src/errors.ts`**

Add at the end of the file, after the `CallerClaims` interface:

```ts
/**
 * The guard every back-office-only callable starts with.
 *
 * Role and status collapse into one message on purpose: an inactive
 * back-office account and a b2b account are both simply "not allowed here",
 * and distinguishing them in the copy would tell a caller which half of the
 * check they failed.
 */
export function assertBackoffice(caller: CallerClaims): void {
  if (caller.role !== "backoffice" || caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée à l'équipe Bike-eco.");
  }
}
```

- [ ] **Step 3: Remove the duplicate from `functions/src/registration/backoffice.ts`**

Change the import on line 1 from:

```ts
import { RegError, type CallerClaims } from "../errors";
```

to:

```ts
import { assertBackoffice, RegError, type CallerClaims } from "../errors";
```

`CallerClaims` stays: it still annotates the `caller` parameter of both
`approveCompanyCore` (line 24) and `deleteCompanyCore` (line 41). `RegError`
stays too — the not-found and failed-precondition throws still use it.

Then delete the entire local definition at lines 16-20:

```ts
function assertBackoffice(caller: CallerClaims): void {
  if (caller.role !== "backoffice" || caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée à l'équipe Bike-eco.");
  }
}
```

Leave both `assertBackoffice(caller)` call sites untouched — they now resolve to
the import.

- [ ] **Step 4: Verify the move changed nothing**

```bash
cd functions && npx tsc --noEmit && npx jest src/registration/backoffice.test.ts
```

Expected: PASS, with the same test count as Step 1.

- [ ] **Step 5: Commit**

```bash
git add functions/src/errors.ts functions/src/registration/backoffice.ts
git commit -m "refactor(functions): share assertBackoffice from errors.ts"
```

---

### Task 2: `deleteDossier` core + schema

The pure, dependency-injected heart of the feature. No Firebase imports — everything the core touches comes in through `DossierDeleteDeps`, which is what makes it testable.

**Files:**
- Create: `functions/src/dossiers/schemas.ts`
- Create: `functions/src/dossiers/core.ts`
- Test: `functions/src/dossiers/schemas.test.ts`
- Test: `functions/src/dossiers/core.test.ts`

**Interfaces:**
- Consumes: `assertBackoffice(caller: CallerClaims): void` and `RegError` from `functions/src/errors.ts` (Task 1).
- Produces:
  - `deleteDossierSchema` — a `ZodType<DeleteDossierInput>` where `DeleteDossierInput = { dossierId: string }`.
  - `interface DossierDeleteDeps { getDossier(id: string): Promise<{ companyId: string } | null>; deleteStorage(companyId: string, dossierId: string): Promise<void>; deleteDossier(id: string): Promise<void>; }`
  - `deleteDossierCore(input: DeleteDossierInput, caller: CallerClaims, deps: DossierDeleteDeps): Promise<void>`

  Task 3 implements `DossierDeleteDeps` against firebase-admin and wires `deleteDossierCore` into `authedCall`.

- [ ] **Step 1: Write the failing schema test**

Create `functions/src/dossiers/schemas.test.ts`:

```ts
import { expect, test } from "@jest/globals";

import { deleteDossierSchema } from "./schemas";

test("accepts a plain document id", () => {
  expect(deleteDossierSchema.parse({ dossierId: "dos_1" })).toEqual({ dossierId: "dos_1" });
});

test("trims surrounding whitespace", () => {
  expect(deleteDossierSchema.parse({ dossierId: "  dos_1  " })).toEqual({ dossierId: "dos_1" });
});

test("rejects a multi-segment path", () => {
  // Without the single-segment guard this resolves to an unrelated document
  // under `db().collection("dossiers").doc(id)`.
  expect(() => deleteDossierSchema.parse({ dossierId: "dos_1/messages/msg_1" })).toThrow();
});

test("rejects an empty id", () => {
  expect(() => deleteDossierSchema.parse({ dossierId: "   " })).toThrow();
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd functions && npx jest src/dossiers/schemas.test.ts
```

Expected: FAIL — `Cannot find module './schemas'`.

- [ ] **Step 3: Write `functions/src/dossiers/schemas.ts`**

```ts
import { z } from "zod";

// A single path segment only: letters, digits, underscore, hyphen — what
// Firestore auto-ids and this project's own ids are made of. Without this, a
// value like "dos_1/messages/msg_1" reaches `db().collection("dossiers").doc(id)`
// as a multi-segment path and resolves to an unrelated document — which here
// would mean deleting the wrong thing.
const DOSSIER_ID = /^[A-Za-z0-9_-]+$/;

export const deleteDossierSchema = z.object({
  dossierId: z.string().trim().min(1).regex(DOSSIER_ID),
});

export type DeleteDossierInput = z.infer<typeof deleteDossierSchema>;
```

- [ ] **Step 4: Run the schema test to verify it passes**

```bash
cd functions && npx jest src/dossiers/schemas.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing core test**

Create `functions/src/dossiers/core.test.ts`:

```ts
import { expect, test } from "@jest/globals";

import type { CallerClaims } from "../errors";
import { deleteDossierCore, type DossierDeleteDeps } from "./core";

const boCaller: CallerClaims = { uid: "bo1", role: "backoffice", status: "active", companyId: null };

function fakeDeps(over: Partial<DossierDeleteDeps> = {}) {
  const order: string[] = [];
  const deps: DossierDeleteDeps = {
    getDossier: async () => ({ companyId: "comp_1" }),
    deleteStorage: async (companyId, dossierId) => {
      order.push(`storage:${companyId}/${dossierId}`);
    },
    deleteDossier: async (id) => { order.push(`doc:${id}`); },
    ...over,
  };
  return { deps, order };
}

test("deletes Storage then the document, keyed by the stored companyId", async () => {
  // The companyId comes from the document, never the payload — that is what
  // stops a caller aiming the prefixed delete at another company's files.
  const { deps, order } = fakeDeps();
  await deleteDossierCore({ dossierId: "dos_1" }, boCaller, deps);
  expect(order).toEqual(["storage:comp_1/dos_1", "doc:dos_1"]);
});

test("rejects a b2b caller and deletes nothing", async () => {
  const { deps, order } = fakeDeps();
  await expect(
    deleteDossierCore({ dossierId: "dos_1" }, { uid: "u", role: "b2b", status: "active", companyId: "c" }, deps),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(order).toEqual([]);
});

test("rejects a back-office caller that is not active", async () => {
  const { deps, order } = fakeDeps();
  await expect(
    deleteDossierCore({ dossierId: "dos_1" }, { uid: "bo1", role: "backoffice", status: "pending", companyId: null }, deps),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(order).toEqual([]);
});

test("rejects an unknown dossier before deleting anything", async () => {
  const { deps, order } = fakeDeps({ getDossier: async () => null });
  await expect(deleteDossierCore({ dossierId: "nope" }, boCaller, deps)).rejects.toMatchObject({
    code: "not-found",
  });
  expect(order).toEqual([]);
});

test("a failing Storage delete leaves the document alone", async () => {
  // Storage-first ordering means a half-failure leaves a readable dossier with
  // broken images — visible and retryable — rather than orphaned files no
  // document points at.
  const { deps, order } = fakeDeps({
    deleteStorage: async () => { throw new Error("bucket down"); },
  });
  await expect(deleteDossierCore({ dossierId: "dos_1" }, boCaller, deps)).rejects.toThrow("bucket down");
  expect(order).toEqual([]);
});
```

- [ ] **Step 6: Run it to verify it fails**

```bash
cd functions && npx jest src/dossiers/core.test.ts
```

Expected: FAIL — `Cannot find module './core'`.

- [ ] **Step 7: Write `functions/src/dossiers/core.ts`**

```ts
import { assertBackoffice, RegError, type CallerClaims } from "../errors";
import type { DeleteDossierInput } from "./schemas";

export interface DossierDeleteDeps {
  /** The dossier's `companyId`, which forms the Storage prefix, or null when
   *  no such document exists. */
  getDossier(id: string): Promise<{ companyId: string } | null>;
  /** Deletes every object under `dossiers/{companyId}/{dossierId}/`. */
  deleteStorage(companyId: string, dossierId: string): Promise<void>;
  /** Deletes the document *and* its subcollections. */
  deleteDossier(id: string): Promise<void>;
}

/**
 * Permanently delete one dossier: its Storage folder, then its document and
 * every subcollection under it (`messages`, `mutes`).
 *
 * Back-office only. The `companyId` that forms the Storage prefix is read from
 * the stored document, never from the payload — otherwise the callable would
 * be a way to aim a prefixed delete at another company's files.
 *
 * Storage first, Firestore second, mirroring `deleteCompanyCore`. If the
 * document delete fails after the files are gone, the dossier is still
 * readable but its images 404 — visible, and fixed by pressing the button
 * again. The reverse order would leave files that no document points at,
 * invisible to every screen and reachable only with bucket access.
 */
export async function deleteDossierCore(
  input: DeleteDossierInput,
  caller: CallerClaims,
  deps: DossierDeleteDeps,
): Promise<void> {
  assertBackoffice(caller);

  const dossier = await deps.getDossier(input.dossierId);
  if (!dossier) throw new RegError("not-found", "Dossier introuvable.");

  await deps.deleteStorage(dossier.companyId, input.dossierId);
  await deps.deleteDossier(input.dossierId);
}
```

- [ ] **Step 8: Run the core test to verify it passes**

```bash
cd functions && npx jest src/dossiers/
```

Expected: PASS, 9 tests across the two files.

- [ ] **Step 9: Commit**

```bash
git add functions/src/dossiers/schemas.ts functions/src/dossiers/schemas.test.ts \
        functions/src/dossiers/core.ts functions/src/dossiers/core.test.ts
git commit -m "feat(functions): add deleteDossier core and payload schema"
```

---

### Task 3: Wire the `deleteDossier` callable

Bind the core to firebase-admin and export it. Not unit-tested, per `docs/tech/verification.md` — wiring is gated by `tsc` and lint.

**Files:**
- Create: `functions/src/dossiers/index.ts`
- Modify: `functions/src/index.ts:8-19` (the re-export block)

**Interfaces:**
- Consumes: `deleteDossierCore`, `DossierDeleteDeps` (Task 2, `./core`); `deleteDossierSchema` (Task 2, `./schemas`); `authedCall`, `db` from `../callable`.
- Produces: a deployed callable named `deleteDossier`, accepting `{ dossierId: string }` and resolving to `{ ok: true }`. Task 4 calls it by that name.

- [ ] **Step 1: Write `functions/src/dossiers/index.ts`**

```ts
import { getStorage } from "firebase-admin/storage";

import { authedCall, db } from "../callable";
import { deleteDossierCore, type DossierDeleteDeps } from "./core";
import { deleteDossierSchema } from "./schemas";

function dossierDeleteDeps(): DossierDeleteDeps {
  return {
    getDossier: async (id) => {
      const snap = await db().collection("dossiers").doc(id).get();
      if (!snap.exists) return null;
      return { companyId: snap.data()!.companyId as string };
    },
    // One prefixed delete covers all three shapes `src/lib/storage/paths.ts`
    // writes under a dossier: `photos/{index}.{ext}`, `photos/thumb.jpg`, and
    // `messages/{messageId}/{fileName}`. No enumeration needed.
    deleteStorage: async (companyId, dossierId) => {
      await getStorage().bucket().deleteFiles({
        prefix: `dossiers/${companyId}/${dossierId}/`,
      });
    },
    // Recursive, not a plain delete: a plain `.delete()` on a document leaves
    // its subcollections behind as orphaned data. This sweeps `messages` and
    // `mutes` with it.
    deleteDossier: async (id) => {
      await db().recursiveDelete(db().collection("dossiers").doc(id));
    },
  };
}

/** Permanently delete one dossier, its conversations and its documents. */
export const deleteDossier = authedCall(
  deleteDossierSchema,
  (input, caller) => deleteDossierCore(input, caller, dossierDeleteDeps()),
);
```

- [ ] **Step 2: Re-export it from `functions/src/index.ts`**

Add this line to the export block, keeping it alphabetically ordered with the
neighbouring `export { sendDossierRecap } from "./dossierEmail";` line — insert
it directly ABOVE that one:

```ts
export { deleteDossier } from "./dossiers";
```

- [ ] **Step 3: Verify it compiles and lints**

```bash
cd functions && npx tsc --noEmit && npm run lint
```

Expected: both clean, no output errors.

- [ ] **Step 4: Run the whole functions suite**

```bash
cd functions && npx jest
```

Expected: PASS. Nothing should have regressed.

- [ ] **Step 5: Commit**

```bash
git add functions/src/dossiers/index.ts functions/src/index.ts
git commit -m "feat(functions): expose deleteDossier callable"
```

---

### Task 4: Client callable wrapper

**Files:**
- Create: `src/lib/data/dossiers.ts`

**Interfaces:**
- Consumes: the `deleteDossier` callable (Task 3); `call` from `./callable`.
- Produces: `callDeleteDossier(dossierId: string): Promise<void>`. Task 5 imports it from `@/lib/data/dossiers`.

- [ ] **Step 1: Write `src/lib/data/dossiers.ts`**

Mirrors `src/lib/data/registration.ts`: the shared `call` helper already maps a
thrown `HttpsError` to French copy via `frenchError`, so there is nothing to
catch here. `.then(() => undefined)` drops the `{ ok: true }` acknowledgement,
which no caller reads.

```ts
import { call } from "./callable";

/** Permanently delete a dossier, its messages and its Storage files.
 *  Back-office only — the callable rejects anyone else. */
export const callDeleteDossier = (dossierId: string) =>
  call<{ dossierId: string }, { ok: true }>("deleteDossier", { dossierId }).then(
    () => undefined,
  );
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/dossiers.ts
git commit -m "feat(data): add callDeleteDossier wrapper"
```

---

### Task 5: Delete button, modal and redirect on the management screen

Adds the "Gérer ce dossier" section at the bottom of the management tab, its
confirmation modal, and the redirect. No test — screens are gated by `tsc` +
lint per `docs/tech/verification.md`.

Two behaviours here are easy to get wrong and are the reason this task exists as
its own reviewable unit:

1. **The `busy` lock.** Update and delete are two writes against the same
   dossier. Both buttons disable while either is in flight.
2. **The deleted-document flash.** `useDossier` is a live listener. The instant
   the callable's delete commits, the snapshot fires with no document and the
   screen's own `!data` branch would paint "Dossier introuvable." for a frame —
   telling the user their successful delete found nothing. A `deleted` flag,
   set the moment the callable resolves, holds the spinner until the redirect
   unmounts the screen.

**Files:**
- Modify: `src/app/(backoffice)/dossier/[id]/management.tsx` (whole file rewritten below)

**Interfaces:**
- Consumes: `callDeleteDossier` (Task 4); the existing `ConfirmModal`, `Section`, `Button`, `ScreenLoader`, `useAsyncAction`, `alertDialog`, `useDossier`, `useDossierManagement`, `DossierManagementForm`.
- Produces: nothing consumed by a later task.

- [ ] **Step 1: Rewrite `src/app/(backoffice)/dossier/[id]/management.tsx`**

`ConfirmModal` already renders `Annuler` followed by a danger button labelled
with `confirmLabel`, so the two-button layout needs no component change.

```tsx
import { useGlobalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import DossierManagementForm from "@/components/form/DossierManagementForm";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ScreenMessage from "@/components/ui/ScreenMessage";
import Section from "@/components/ui/Section";
import { ScreenLoader } from "@/components/ui/Spinner";
import { callDeleteDossier } from "@/lib/data/dossiers";
import { useAccount } from "@/lib/data/useAccount";
import { useDossier } from "@/lib/data/useDossier";
import { useDossierManagement } from "@/lib/data/useDossierManagement";
import { alertDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";

export default function BackofficeDossierManagement() {
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useAccount();
  const { data, loading, error } = useDossier(id);
  const { updateManagement, pending } = useDossierManagement({
    onError: (message) => alertDialog("Mise à jour impossible", message),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  // `useDossier` is a live listener: the delete commits, the snapshot fires
  // empty, and the `!data` branch below would flash "Dossier introuvable." on a
  // successful delete. This holds the spinner until the redirect unmounts us.
  const [deleted, setDeleted] = useState(false);

  const deleting = useAsyncAction(
    async () => {
      await callDeleteDossier(id);
      setDeleted(true);
      router.replace({
        pathname: "/(backoffice)/confirmation",
        params: {
          title: "Dossier supprimé",
          message: "Le dossier a bien été supprimé.",
          redirectTo: "/(backoffice)/(tabs)/dashboard",
        },
      });
    },
    { onError: (message) => alertDialog("Suppression impossible", message) },
  );

  // One lock for both writes — they target the same dossier, so neither may
  // start while the other is in flight.
  const busy = pending || deleting.pending;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {loading || deleted ? (
        <ScreenLoader />
      ) : error ? (
        <ScreenMessage message={error} tone="danger" />
      ) : !data ? (
        <ScreenMessage message="Dossier introuvable." />
      ) : (
        <>
          <DossierManagementForm
            initialRegion={data.region}
            initialStatus={data.status}
            initialPrice={data.validatedPrice}
            busy={busy}
            onSubmit={async (region, status, price) => {
              if (!session) return;
              if (await updateManagement(id, region, status, price, session.id)) {
                router.replace("/(backoffice)/confirmation");
              }
            }}
          />

          <Section title="Gérer ce dossier">
            <Button
              variant="danger"
              label="Supprimer ce dossier"
              onPress={() => setConfirmDelete(true)}
              loading={deleting.pending}
              disabled={busy}
            />
          </Section>

          <ConfirmModal
            visible={confirmDelete}
            title="Supprimer ce dossier ?"
            message="Cette action supprime définitivement le dossier, ses conversations et ses documents associés."
            confirmLabel="Supprimer ce dossier"
            disabled={busy}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => {
              setConfirmDelete(false);
              void deleting.run();
            }}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.xl },
});
```

The `content` style gains `gap: tokens.space.xl` (28, already defined in
`src/theme/tokens.ts:35`) to separate the form from the new section.

- [ ] **Step 2: Verify the full gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all three green.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(backoffice)/dossier/[id]/management.tsx"
git commit -m "feat(backoffice): delete a dossier from the management tab"
```

---

### Task 6: Update the page spec

`AGENTS.md` requires a spec to be kept in sync in the same change that alters
its feature.

**Files:**
- Modify: `docs/specs/page-dossier-management.md`

**Interfaces:**
- Consumes: the behaviour built in Tasks 1–5.
- Produces: nothing.

- [ ] **Step 1: Append the new section to `docs/specs/page-dossier-management.md`**

Insert this AFTER the "Main section" content (after the "Mettre à jour" /
`updatedBy` paragraph) and BEFORE the "## Loading and error states" heading:

```markdown
### Gérer ce dossier

At the bottom of the screen, below "Mettre à jour", a section titled "Gérer ce
dossier" holds one danger button, "Supprimer ce dossier". Back-office only —
this whole page is.

Tapping it opens a confirmation modal:

- title: "Supprimer ce dossier ?"
- message: "Cette action supprime définitivement le dossier, ses conversations
  et ses documents associés."
- "Annuler" closes the modal and changes nothing.
- "Supprimer ce dossier" (danger) calls the `deleteDossier` callable.

The callable deletes, in this order, the dossier's Storage folder
(`dossiers/{companyId}/{dossierId}/` — every photo, the thumbnail, and every
message attachment) and then the dossier document with its `messages` and
`mutes` subcollections. The `companyId` is read server-side from the stored
document, never taken from the request.

While the delete is in flight the button spins and "Mettre à jour" is disabled,
so the two writes cannot race. On success the page redirects to the
confirmation screen — "Dossier supprimé" / "Le dossier a bien été supprimé." —
which auto-redirects to the dashboard after 1500 ms. On failure an alert titled
"Suppression impossible" shows the mapped French error and the page stays put,
so the action can be retried.

No notification is sent: the seller is not told their dossier was deleted.
```

- [ ] **Step 2: Update the loading-states paragraph**

In the "## Loading and error states" section, append this paragraph so the
deleted-document behaviour is documented alongside the other states:

```markdown
The dossier read is a live listener, so a successful delete makes it fire with
no document. The page holds the spinner from the moment the delete succeeds
until the redirect lands, rather than flashing "Dossier introuvable." at a user
whose deletion just worked.
```

- [ ] **Step 3: Commit**

```bash
git add docs/specs/page-dossier-management.md
git commit -m "docs: spec the dossier delete action on the management page"
```

---

## Manual verification

Automated tests cover the core's authorization, ordering and id validation.
They do NOT cover that the real Storage prefix and `recursiveDelete` actually
erase things — that needs the emulators or the live project. After Task 6:

1. Sign in as a back-office account (see `docs/ops/first-backoffice-account.md`).
2. Open a dossier that has at least one photo AND at least one chat message
   with a PDF or photo attachment.
3. Go to the "Statut dossier" tab, tap "Supprimer ce dossier", confirm.
4. Expect: button spins → "Dossier supprimé" → dashboard, with the dossier gone
   from every section.
5. In the Firebase console, confirm `dossiers/{id}` is gone along with its
   `messages` subcollection, and that `dossiers/{companyId}/{dossierId}/` no
   longer exists in the Storage bucket.
6. Sign in as the B2B seller who owned it and confirm the dossier is absent from
   their dashboard.
