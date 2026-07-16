# Slices 2 & 3 — Dossier data layer: reads + writes (design)

_Date: 2026-07-16 · Branch: `feat/init-firestore-and-storage`_

## Context

Slice 1 (auth, session, claims, default-deny rules) is complete except Task 9
(Google sign-in), which is blocked on console/OAuth setup and a native rebuild the
agent cannot perform. Task 9 is **skipped, not cancelled** — nothing in this design
depends on it, because Google sign-in produces the same claims-backed session as
email/password.

This spec covers the two remaining app-facing slices together:

- **Slice 2** — dossier reads: swap the four stubbed read hooks to `onSnapshot`.
- **Slice 3** — dossier writes: B2B submission (Firestore + Storage), back-office
  management updates, and chat messages with attachments.

They are combined into one spec because both rewrite the same data layer and both
edit `firestore.rules`. Designing the read rules without knowing the write rules
would mean authoring that file twice and reviewing it twice. The **implementation
plan is split into two phases** (A = reads, B = writes) so reads are demonstrably
working before writes land on top.

### Current state (verified)

- `useDossiers` / `useDossier` / `useMessages` — `setTimeout` stubs over `fixtures.ts`.
- `useDossierMutations` — one grab-bag hook; `updateManagement`/`sendMessage`/`invite`
  all `console.log` + resolve.
- `submitB2bSubmission` — stub; simulates 400ms latency.
- `filter.ts` — `selectByStatus` / `filterDossiersByRegion`, client-side.
- `fixtures.ts` — `MOCK_COMPANIES` and `MOCK_USERS` are **already dead** (slice 1
  removed their consumers). The only other live export is a `WithId` type re-export.
- `ChatThread` — **already renders attachments** (file icon + name), per `page-chat.md`.
- `ChatComposer` — "+" opens a Photo/PDF sheet; both buttons are no-ops.
- `firestore.rules` — default-deny; dossiers readable, **all writes `false`**.
- `storage.rules` — default-deny everything.
- `firestore.indexes.json` — empty.
- Deps present: `expo-image-picker`, `expo-file-system`. Absent:
  `expo-document-picker`, `expo-image-manipulator`.
- `functions/src/regions.ts` (server) and `src/constants/departments.ts` (client)
  both map département → NORTH/SOUTH.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Doc structure | **One spec, one plan, two phases** (A reads, B writes). |
| 2 | Query granularity | **Three status-scoped listeners.** `useDossiers(statuses, region)` keeps its exact signature; the only consumer edit is an import path (see Deletions). |
| 3 | Chat attachments | **In scope for phase B.** Slice 3 already wires Storage, message writes, and `storage.rules`; deferring would mean revisiting all three. `ChatThread` rendering already exists. |
| 4 | Region on create | **Client-derived, back-office-correctable.** Not a security boundary (see below). |
| 5 | Dead schema fields | **Delete `lastMessageAt` and `assignedTo`** from `Dossier`. |
| 6 | Storage path | **Keyed by `companyId`** so rules decide from claims with no cross-service read. |
| 7 | Write path | **Direct client writes + narrow rules.** Cloud Functions stay scoped to slice 4 (registration). |
| 8 | Thumbnails | **Client-side downscale** at upload via `expo-image-manipulator`. |

### On Decision 4 (client-set region)

`region` routes a dossier to the NORTH or SOUTH team. A malicious b2b client could
write the wrong one. This is accepted because:

1. Every back-office user can already read **every** dossier regardless of region
   (`isBackoffice()` in the read rule), so a wrong region leaks nothing.
2. `page-dossier-management.md` makes region **explicitly reassignable** by the
   back-office ("Région attribuée"), so mis-routing is correctable by design.
3. Validating the département→region mapping in rules would mean encoding ~96
   département codes into `firestore.rules`.

The rule still constrains `region in ['NORTH','SOUTH']` so the field can't hold junk.

### On Decision 5 (deleting `lastMessageAt` and `assignedTo`)

Neither field is read or written anywhere in the app — they exist only in
`fixtures.ts` and `scripts/seed.ts`.

- **`lastMessageAt`**: its one plausible consumer would be recency ordering, but
  `component-dossiers-section.md` specifies "Entries are ordered by submission date"
  — `createdAt`. Maintaining it would require granting clients dossier-update rights
  or adding a Cloud Function trigger, for no consumer.
- **`assignedTo`**: its schema comment says "team member handling it", but the only
  assignment concept in any spec is `page-dossier-management.md`'s "Région attribuée"
  — region reassignment, which the `region` field already covers.

A declared-but-never-written field is worse than an absent one: `Timestamp | null`
cannot distinguish "no messages yet" from "never maintained", so the first
`orderBy("lastMessageAt")` silently returns nothing. Absent, the type error is
immediate. Git history preserves them; re-adding is one schema line plus a write.

The payoff is that the back-office update rule narrows to exactly what
`DossierManagementForm` submits, so the rules describe the real app rather than a
speculative one.

## Architecture

### Phase A — reads (slice 2)

**Query shape.** The b2b `companyId` constraint is mandatory, not an optimization:
the read rule is `resource.data.companyId == myCompany()`, and Firestore rejects any
list query it cannot statically prove satisfies that rule.

| Hook | b2b | back-office |
|------|-----|-------------|
| `useDossiers(statuses, region)` | `where companyId ==` + `where status in` + `orderBy createdAt` | `where status in` + `orderBy createdAt`, plus `where region ==` when the preference filter is set |
| `useDossier(id)` | `onSnapshot(dossierDoc(id))` | same |
| `useMessages(dossierId)` | `onSnapshot(query(messagesRef(id), orderBy("createdAt")))` | same |

Each returns `{ data, loading, error }` — `error` is new, carrying French copy from
`mapDataError`. Hooks subscribe only once session claims resolve; while
`useAuth().loading` is true, or a b2b user has no `companyId`, they stay in `loading`
and issue no query.

**Composite indexes** (`firestore.indexes.json`):
- `(companyId ASC, status ASC, createdAt ASC)` — b2b sections.
- `(status ASC, createdAt ASC)` — back-office, "Toute la France".
- `(region ASC, status ASC, createdAt ASC)` — back-office, region-filtered.

Messages order by `createdAt` alone — single-field, automatically indexed.

**Deletions.** `filter.ts` and `filter.test.ts` are removed: the server does that
work now, and keeping them would leave two competing filter paths. `fixtures.ts` is
removed entirely — after `MOCK_DOSSIERS`/`messagesFor` go, only the dead mocks and a
`WithId` forward remain. `DossiersSection.tsx` and `DashboardScreen.tsx` repoint
their `WithId` import to `@/lib/firestore/collections`. This completes slice 1's
deferred "removal of `fixtures.ts`".

`useDossiers.test.ts` is removed rather than ported: it asserts the stub's
`setTimeout` timing, which has no successor once the hook is a listener. Its
replacement coverage is the rules tests (query legality) plus the Phase A
walkthrough — see Testing.

### Phase B — writes (slice 3)

**Submission** — `submitB2bSubmission(values, session)`:

1. `const ref = doc(dossiersRef)` — mints an id **without** writing.
2. Downscale photo 0 → thumbnail; upload it and every full photo under that id.
3. `setDoc(ref, payload)` **last**, with `photos` and `thumbnailUrl` resolved.

The document is written last so a failed upload leaves no dossier. The cost is
orphaned Storage objects, which is preferable to a dossier pointing at photos that
do not exist. Orphan cleanup is out of scope (see below).

**Storage layout** — keyed by company, so rules read claims only:

```
dossiers/{companyId}/{dossierId}/photos/{index}.{ext}
dossiers/{companyId}/{dossierId}/photos/thumb.jpg
dossiers/{companyId}/{dossierId}/messages/{messageId}/{filename}
```

Filenames need no randomness: the `{dossierId}`/`{messageId}` segment is a fresh
Firestore id, so collisions are impossible within it. `{ext}` derives from the
picked asset's `mimeType` (the picker can return HEIC or PNG, not only JPEG) and the
same value is set as the upload's `contentType`, since the Storage rule matches on
it. `thumb.jpg` is always JPEG — `expo-image-manipulator` outputs it.

Back-office users have **no `companyId` claim**, so their rule branch is
`role == 'backoffice'`, permitting writes into any company's path — they have
already read the dossier, so they know the id. This is why the path is keyed by
company rather than resolved through `firestore.get()` from Storage rules: the
latter would also fail for submission, where the dossier document does not exist
until after the uploads.

**Mutation hooks split.** `useDossierMutations` becomes three focused hooks —
`useDossierManagement`, `useSendMessage`, `useInvite` (still stubbed; slice 4).
Today every call site imports all three concerns to use one.

**Sender name** — `formatSenderName(user, companyName)` (pure): back-office →
`"Alex Martin - Bike-eco"`; b2b → `"Camille Durand - Garage du Nord"`, taking the
name from `dossier.submitter.companyName` (rules only let a company message its own
dossiers, so that value is always the sender's company). `DossierChatScreen`
therefore also subscribes `useDossier(id)`; Firestore serves it from cache when the
detail screen already holds that listener.

**Firestore rules** added to the existing `dossiers` match:

```
allow create: if isActive() && claims().role == 'b2b'
  && request.resource.data.companyId == myCompany()
  && request.resource.data.submittedBy == request.auth.uid
  && request.resource.data.status == 'a_traiter'
  && request.resource.data.negotiatedPrice == null
  && request.resource.data.region in ['NORTH', 'SOUTH'];

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
```

The existing `read` rule's inline participant test is extracted to a named helper so
`read` and `create` cannot drift apart:

```
function isDossierParticipant(dossierId) {
  return isBackoffice()
    || (isActive() && get(/databases/$(database)/documents/dossiers/$(dossierId))
          .data.companyId == myCompany());
}
```

Rules pin the fields that are free to check from claims. The denormalized
`submitter` block (nom/prénom/companyName) is **accepted as the client sends it**
rather than validated against the `users` doc: doing so would cost a `get()` on every
create to police a card label, and a b2b user can only mislead about their own
identity.

**Storage rules** replace the blanket deny. `storage.rules` is a separate service
with no access to `firestore.rules`' helpers, so `claims()`/`isActive()`/
`isBackoffice()` are re-declared there — duplicated by the platform, not by choice:

```
match /dossiers/{companyId}/{dossierId}/{allPaths=**} {
  allow read:  if isActive() && (isBackoffice() || claims().companyId == companyId);
  allow write: if isActive() && (isBackoffice() || claims().companyId == companyId)
    && request.resource.size < 10 * 1024 * 1024
    && request.resource.contentType.matches('image/.*|application/pdf');
  allow delete: if false;
}
```

**Known, accepted:** `getDownloadURL` returns a tokenized URL that bypasses these
read rules, and `schema.ts` already specifies `photos: string[] // Storage download
URLs`. Anyone holding a URL can fetch the object. The schema is unchanged here; this
is recorded so it is a decision rather than a surprise.

### Error handling

New `src/lib/data/dataErrors.ts` — `mapDataError(code)`, mirroring the existing
`mapAuthError`: `permission-denied` → "Vous n'avez pas accès à ce dossier.",
`unavailable` → "Connexion impossible. Vérifiez votre réseau.", `not-found` →
"Ce dossier n'existe plus.", fallback → "Une erreur est survenue. Veuillez
réessayer." Pure, so unit-testable without importing `firebaseConfig`.

Read hooks surface `error` through their return. Write call sites keep their existing
`Alert.alert` pattern (already in `management.tsx`), fed by `mapDataError`.

## Testing

The plan's hermetic constraint holds: **pure logic under test must not import
`firebaseConfig`** (jest-expo resolves the native file and pulls in the real SDK).

**Pure unit tests** — the logic worth protecting is extracted to keep it importable:
- `toDossierPayload(values, session, urls)` → `src/features/b2b-submission/toDossier.ts`.
  Form → document mapping: string→number coercion, région derivation, defaults.
- `formatSenderName(user, companyName)`.
- `mapDataError(code)`.
- Storage path builders (`dossierPhotoPath`, `messageAttachmentPath`).

**Emulator-backed rules tests** — `rules.test.ts` extends to the new surface, and
gains a Storage counterpart via `initializeTestEnvironment({ storage: { rules } })`;
`test:rules` widens to `--only firestore,storage`. This is where query legality is
actually proven — a b2b list query missing its `companyId` constraint fails here.
Cases: create pinned to claims; create rejected for another company / with a
seeded `negotiatedPrice` / with `status != 'a_traiter'`; update field allow-list;
b2b update rejected; message create as each role; cross-company message denied;
Storage write allowed in own company path, denied in another's, denied over-size,
denied on a disallowed content type.

**Hooks** get an emulator walkthrough rather than mock-heavy unit tests; mocking
`onSnapshot` would assert the mock, not the query.

`scripts/seed.ts` is updated: `lastMessageAt`/`assignedTo` dropped, a `messages`
subcollection seeded per dossier, and a second company added so cross-company denial
is exercisable by hand.

## Out of scope (deferred)

- **Task 9 / Google sign-in** — blocked on owner console setup + native rebuild.
- **Registration Cloud Functions**, `submit*Registration`, `invite` — slice 4.
  `useInvite` stays stubbed.
- **Apple & Facebook** providers.
- **Orphaned Storage cleanup** for failed submissions — needs a scheduled function.
- **Pagination** of closed dossiers — no spec calls for it; revisit when real volume exists.
- **Offline write queueing** beyond what the Firestore SDK does by default.
- **`lastMessageAt` / `assignedTo`** — deleted, per Decision 5.

## New dependencies

- `expo-document-picker` — the PDF half of the chat "+" sheet.
- `expo-image-manipulator` — client-side thumbnail downscale.

## Verification strategy

- `npx tsc --noEmit`, `npm run lint`, `npx jest` — clean.
- `npm run test:rules` — Firestore + Storage rules tests pass.
- **Phase A walkthrough** (emulators + seed): the b2b user sees only their company's
  dossiers, split across the correct sections; the back-office user sees all, and the
  "Région gérée" picker filters live; a dossier detail and its chat thread load.
- **Phase B walkthrough**: submitting "Vendre une moto" creates a dossier with photos
  that appears on both dashboards without a reload (listener, not refetch); the
  back-office updates status/région/prix and the b2b dashboard reflects it live;
  messages and attachments round-trip both directions.
- **Negative check**: signed in as b2b, a hand-issued write to another company's
  dossier is rejected — confirming rules, not just UI, enforce the boundary.
