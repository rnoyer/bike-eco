# Delete dossier — design

**Date:** 2026-08-11
**Status:** designed

## Goal

A back-office user can permanently delete a dossier and everything hanging off
it: its `messages` and `mutes` subcollections in Firestore, and its photos,
thumbnail and message attachments in Storage.

Back-office only. The button lives on a tab B2B users cannot reach, and the
callable rejects them regardless.

## Flow

1. Back-office user opens the "Statut dossier" tab
   (`/(backoffice)/dossier/{id}/management`) and taps `Supprimer ce dossier` at
   the bottom of the screen.
2. `ConfirmModal` opens — "Supprimer ce dossier ?" / "Cette action supprime
   définitivement le dossier, ses conversations et ses documents associés." —
   with `Annuler` and a danger `Supprimer ce dossier`.
3. Confirming closes the modal and spins the danger button while the client
   calls `deleteDossier` with `{ dossierId }`.
4. The function reads the dossier for its `companyId`, deletes the Storage
   prefix, then recursively deletes the Firestore document, and acknowledges.
5. The client redirects to the back-office confirmation screen — "Dossier
   supprimé" / "Le dossier a bien été supprimé." — which auto-redirects to the
   dashboard after 1500 ms.

The client sends nothing but the dossier id. The `companyId` that forms the
Storage prefix is read server-side, never taken from the payload, so a caller
cannot aim the prefixed delete at another company's files.

## Why a callable and not a client-side delete

`firestore.rules` sets `allow delete: if false` on `dossiers/{dossierId}` and
`allow create, update, delete: if false` on its `messages` subcollection. A
client-side delete would mean loosening both, plus `storage.rules`, and then
hand-rolling a recursive walk over the messages and a `listAll` over the Storage
folder — work that can half-finish on a dropped connection and leave a dossier
with no document but live files.

The Admin SDK bypasses rules entirely, so `recursiveDelete` sweeps `messages/**`
and `mutes/**` in one call and both rule files stay locked at `if false`.

A soft delete (a `deletedAt` tombstone filtered out of the dashboards) was
rejected: the confirmation copy promises "supprime définitivement" and names the
conversations and documents, so a tombstone would not be true.

## Server

### New module `functions/src/dossiers/`

Mirrors `functions/src/registration/`'s split — schema, dependency-injected
core, thin wiring — so the core is testable without Firebase.

- `schemas.ts` — `deleteDossierSchema = z.object({ dossierId: z.string().trim().min(1).regex(DOSSIER_ID) })`,
  with the same single-path-segment `DOSSIER_ID` regex as
  `dossierEmail/schemas.ts`. Without it a value like `dos_1/messages/msg_1`
  reaches `db().collection("dossiers").doc(id)` as a multi-segment path and
  resolves to an unrelated document.

- `core.ts` — `deleteDossierCore(input, caller, deps)`:
  1. `assertBackoffice(caller)` — rejects a caller whose `role` is not
     `backoffice` *or* whose `status` is not `active`, with
     `RegError("permission-denied", "Action réservée à l'équipe Bike-eco.")`.
  2. `deps.getDossier(dossierId)` → `null` → `RegError("not-found", "Dossier introuvable.")`.
  3. `deps.deleteStorage(companyId, dossierId)`.
  4. `deps.deleteDossier(dossierId)`.

  `assertBackoffice` today is a private function in `registration/backoffice.ts`.
  Rather than duplicating it, or having a dossier module import from the
  registration feature, it moves to `functions/src/errors.ts` — where its two
  dependencies, `RegError` and `CallerClaims`, already live — and
  `registration/backoffice.ts` imports it from there. Behaviour and copy are
  unchanged, so `registration/backoffice.test.ts` still covers it.

- `index.ts` — the real deps:
  - `getDossier` — `db().collection("dossiers").doc(id).get()`, returning
    `{ companyId }` or `null`.
  - `deleteStorage` — `getStorage().bucket().deleteFiles({ prefix: 'dossiers/{companyId}/{dossierId}/' })`.
  - `deleteDossier` — `db().recursiveDelete(db().collection("dossiers").doc(id))`.

  Exported as `export const deleteDossier = authedCall(deleteDossierSchema, (input, caller) => deleteDossierCore(input, caller, realDeps()));`

- Re-exported from `functions/src/index.ts` alongside the existing callables.

### Deletion order

Storage first, Firestore second — the same rationale `deleteCompanyCore` spells
out. If the Firestore delete fails after the Storage delete succeeded, the
dossier is still readable but its images 404, which is visible and retryable.
The reverse order would leave files no document points at, invisible to every
screen and reachable only by an operator with bucket access.

### Storage prefix coverage

`src/lib/storage/paths.ts` writes exactly three shapes under a dossier:

- `dossiers/{companyId}/{dossierId}/photos/{index}.{ext}`
- `dossiers/{companyId}/{dossierId}/photos/thumb.jpg`
- `dossiers/{companyId}/{dossierId}/messages/{messageId}/{fileName}`

All three sit under `dossiers/{companyId}/{dossierId}/`, so the single prefixed
`deleteFiles` covers them with no per-file enumeration.

## Client

### `src/lib/data/dossiers.ts` (new)

```ts
export const callDeleteDossier = (dossierId: string) =>
  call<{ dossierId: string }, { ok: true }>("deleteDossier", { dossierId })
    .then(() => undefined);
```

Placed beside the other callable wrappers and using the shared `call` helper, so
error mapping to French copy is unchanged.

### `src/app/(backoffice)/dossier/[id]/management.tsx`

Below the existing `DossierManagementForm`, a `Section` titled "Gérer ce
dossier" holding a `variant="danger"` `Button` labelled `Supprimer ce dossier`.
This mirrors the "Gérer cette entreprise" section on the company detail screen.

- `useAsyncAction` drives the button's `loading` state and surfaces failures
  through `alertDialog("Suppression impossible", message)`.
- A single `busy` flag — `deleting.pending` OR the `pending` already returned by
  `useDossierManagement` — disables both the "Mettre à jour" button and the
  delete button, so an update and a delete cannot race on the same dossier.
  `busy` is passed to the form's existing `busy` prop and to `ConfirmModal`'s
  `disabled`.
- `ConfirmModal` needs no change: it already renders `Annuler` followed by a
  danger button whose label is the `confirmLabel` prop, which is exactly the
  two-button layout requested.

On success:

```ts
router.replace({
  pathname: "/(backoffice)/confirmation",
  params: {
    title: "Dossier supprimé",
    message: "Le dossier a bien été supprimé.",
    redirectTo: "/(backoffice)/(tabs)/dashboard",
  },
});
```

No new screen — `/(backoffice)/confirmation` already takes these three optional
search params, which is how the recap-email flow reuses it.

### The deleted-document flash

`useDossier` is a live listener. The moment the callable's delete commits, the
snapshot fires with no document, and the management screen's own
`!data → <ScreenMessage message="Dossier introuvable." />` branch would paint
for a frame before `router.replace` lands — telling the user their successful
delete failed to find anything.

The screen holds a `deleted` flag set the instant the callable resolves, and
renders `<ScreenLoader />` instead of the not-found message while it is set.
The redirect then unmounts the tab.

## Error handling

Every failure is a `RegError` mapped to its `HttpsError` code by `toHttps` and
surfaced by `alertDialog("Suppression impossible", …)`, matching the company
delete screen. The modal is already closed and the screen stays on the
management tab with its data intact, so the action can simply be retried.

## Notifications

None. `onDossierUpdated` fires on `onDocumentUpdated` and is unaffected by a
delete; no new trigger is added. Telling the B2B seller their dossier was
deleted is not in scope for this change.

## Testing

`functions/src/dossiers/core.test.ts`, with fake deps in the style of
`registration/backoffice.test.ts`:

- a `b2b` caller is rejected with `permission-denied`, and nothing is deleted;
- a `backoffice` caller whose `status` is not `active` is rejected likewise;
- an unknown dossier id throws `not-found` before any delete runs;
- a valid delete calls `deleteStorage` with the prefix built from the dossier's
  *stored* `companyId`, then `deleteDossier`, in that order;
- a throwing `deleteStorage` propagates and leaves `deleteDossier` uncalled.

`schemas.test.ts` covers the id regex rejecting a multi-segment path, matching
`dossierEmail/schemas.test.ts`.

No client test: the screen is wiring over an already-tested hook and callable,
which `docs/tech/verification.md` places outside the unit-tested surface.

## Docs to update in the same change

- `docs/specs/page-dossier-management.md` — the new "Gérer ce dossier" section,
  its button, the modal copy, and the confirmation redirect.
