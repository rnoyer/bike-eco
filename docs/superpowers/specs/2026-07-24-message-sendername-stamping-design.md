# Slice 4c — Message `senderName` server-stamping (design)

**Date:** 2026-07-24 · **Status:** Approved (brainstorm)

## Context

Slice 4 was decomposed into three sub-projects (see
`2026-07-23-registration-flows-design.md`): **4a** registration (shipped, PR #9),
**4b** back-office company management (shipped), and **4c — message `senderName`
stamping (FR-2)**, this spec.

Today a chat message is written **client-side**: `useSendMessage.ts` uploads any
attachments to Storage, then `setDoc`s the message straight into
`dossiers/{dossierId}/messages`. `senderName` — the identity label a reader sees on
each bubble — is computed on the client by `formatSenderName()`:

- b2b → `"{prénom} {nom} - {companyName}"`
- backoffice → `"{prénom} {nom} - Bike-eco"`

The message-create security rule enforces `senderId == request.auth.uid` and
`senderRole == claims().role`, **but not `senderName`**. So `senderName` is a free
client-authored string: a b2b dealer can write `"Support - Bike-eco"` and impersonate
the Bike-eco team in the thread. Every other trust-sensitive write in this codebase
already goes through an Admin-SDK `onCall` (`companies` is `allow write: if false`);
message creation is the one hole. 4c closes it.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Authority for `senderName` | **`sendMessage` callable** (Approach A) — an Admin-SDK `onCall` derives `senderName` from server truth and writes the doc. Message-create rule becomes `allow create: if false`. Rejected: validating a client-authored `senderName` in security rules (fragile — hard-codes the format string in rules, adds `get()`s, awkward string ops). |
| 2 | b2b company name source | **The `companies/{caller.companyId}` doc**, *not* `dossier.submitter.companyName` — the dossier-create rule does not constrain `submitter.companyName`, so it is itself client-spoofable. |
| 3 | Attachment upload | **Stays client-side.** The client mints the `messageId`, uploads attachments under it, then calls `sendMessage` with the attachment metadata. Sending file bytes through a callable (base64) is a non-starter for 8 MB photos. |
| 4 | Attachment / message-length validation | **Out of scope** — deferred to launch hardening (4096-char text cap + attachment bounds/prefix check), tracked alongside App Check. This slice is strictly the impersonation fix. |
| 5 | Write semantics | **`.create()`** (fail if the doc already exists) so a replayed/duplicated `messageId` cannot clobber an existing message. |

## Goals

- `senderName` (and `senderId`, `senderRole`, `createdAt`) become **server-set** — the
  client supplies none of them, so spoofing is structurally impossible, not merely
  validated against.
- No visible change to the chat UI or the attachment flow beyond sends now
  round-tripping a callable.

## Non-goals (deferred)

- Message text length limit (**4096 chars**) and attachment bounds / Storage-prefix
  validation — launch hardening (`launch-hardening-todo`).
- App Check enforcement on the new callable — launch hardening.
- Any change to message **read** access or the thread UI.

## Architecture

### 1. Cloud Function — `functions/src/messages/` (2nd-gen `onCall`)

New module mirroring 4a/4b: a pure `core.ts` (`sendMessageCore` + injected `Deps`,
unit-tested without the emulator) under a thin `onCall` wrapper.

**Shared callable infra extraction.** The admin-init block + `db()`, `callerFrom`, and
`toHttps` currently live in `functions/src/registration/index.ts`. Lift them into a new
`functions/src/callable.ts` so a non-registration callable does not import from a module
named "registration". `RegError` / `CallerClaims` move with them (or are re-exported)
and `registration/index.ts` imports them back. Targeted, in-scope improvement — no other
registration behavior changes.

**Input** (Zod `sendMessageSchema`): `{ dossierId: string, messageId: string, text:
string, attachments: MessageAttachment[] }`. `messageId` is a client-minted Firestore id
(attachments were uploaded under it before the doc existed).

**`sendMessageCore(input, caller, deps)`:**

1. `deps.getDossier(dossierId)` → `{ companyId }`; missing ⇒ `not-found`.
2. **Participant assert** (mirrors the rules' `isDossierParticipant`): the caller must be
   `status === "active"`, and then either `role === "backoffice"` **or**
   (`role === "b2b"` && `caller.companyId === dossier.companyId`); else
   `permission-denied`.
3. `deps.getUser(caller.uid)` → `{ prenom, nom }` (server truth for the person).
4. Derive `senderName`:
   - backoffice → `` `${prenom} ${nom} - Bike-eco` ``
   - b2b → `` `${prenom} ${nom} - ${companyName}` ``, where
     `companyName = deps.getCompanyName(caller.companyId)` (Decision 2).
5. `deps.createMessage(dossierId, messageId, { senderId: caller.uid, senderName,
   senderRole: caller.role, text: text.trim(), attachments, createdAt })` — **create
   semantics** (Decision 5); a collision is an error.
6. Return `{ ok: true }`.

**Deps** (each a one-line Firestore/Admin call in `index.ts`, faked in `core.test.ts`):

```ts
interface SendMessageDeps {
  getDossier(id: string): Promise<{ companyId: string } | null>;
  getUser(uid: string): Promise<{ prenom: string; nom: string } | null>;
  getCompanyName(companyId: string): Promise<string | null>;
  createMessage(dossierId: string, messageId: string, data: NewMessage): Promise<void>;
}
```

The `onCall` wrapper requires `req.auth` (else `unauthenticated`), builds the caller via
`callerFrom(req)`, validates with `sendMessageSchema`, calls the core, and maps errors
via the shared `toHttps`. Exported through `functions/src/index.ts` next to the 4a/4b
callables.

### 2. Security rules (`firestore.rules`)

Under `dossiers/{dossierId}/messages/{messageId}`:

- `allow create: if false;` — message creation is now server-only (Admin SDK bypasses
  rules), exactly like `companies`.
- `read` unchanged (`isDossierParticipant(dossierId)`).
- `update, delete` stay `false`.

The `senderId == auth.uid` / `senderRole == claims().role` create predicate is removed
along with the client create path. `rules.test.ts` message-create cases flip to asserting
a direct client create is **denied for every caller** (b2b participant, backoffice, and
outsider alike).

### 3. Client (`src/lib/data/`, `src/components/screens/`, `src/lib/chat/`)

- **`src/lib/data/callable.ts`** (new) — lift the generic `call<T,R>()` + `frenchError()`
  helpers out of `registration.ts` (which keeps its own `callRegisterCompany` etc.,
  importing from the new module). Add `callSendMessage({ dossierId, messageId, text,
  attachments })`.
- **`useSendMessage.ts`** — keep the attachment upload + `cleanUpOnFailure` Storage
  compensation; replace `setDoc(...)` with `await callSendMessage(...)`. Drop the
  `writeWithTimeout` / `deleteDoc` optimistic-buffer guard: a callable throws on
  failure/timeout, so there is no buffered write to undo — only the uploaded Storage
  objects need cleanup on throw (that flow stays). Signature simplifies to
  `useSendMessage(dossierId, companyId)`; the `sender` arg is gone (server derives
  id/name/role from auth). `companyId` is still needed for the attachment Storage path.
- **`DossierChatScreen.tsx`** — drop the `formatSenderName` import and the sender wiring;
  still read `user.id` for `ChatThread currentUserId` (own-vs-other bubble alignment).
- **Delete `src/lib/chat/senderName.ts` + `senderName.test.ts`** — `formatSenderName` is
  now dead (only `DossierChatScreen` referenced it). The label format lives solely on the
  server.

**UX note:** sends lose direct-write immediacy (they round-trip a callable), but the
`useMessages` `onSnapshot` listener reflects the new message on write — the same model as
every other privileged write in the app.

## Testing

- **Core units** (injected `Deps`, no emulator):
  - b2b participant → `senderName == "{prenom} {nom} - {companyName}"` from the company
    doc; message written with server `senderId`/`senderRole`.
  - backoffice → `senderName == "{prenom} {nom} - Bike-eco"`.
  - b2b whose `companyId !== dossier.companyId` ⇒ `permission-denied`, no write.
  - missing dossier ⇒ `not-found`.
  - `createMessage` collision (duplicate `messageId`) ⇒ error surfaced.
- **Emulator integration** (Auth + Firestore):
  - b2b sends via the callable → message lands with the correct server `senderName`.
  - a **direct client `setDoc` to `messages` is denied** (asserts the rule flip).
  - backoffice posts to a dossier of any company.
  - a non-participant b2b caller is denied the callable.

## Owner manual setup

1. Deploy the callable + rules: `firebase deploy --only functions,firestore:rules`.
2. No composite indexes, no data migration.
3. **Launch hardening:** add App Check enforcement and the message/attachment limits
   (4096-char text cap, attachment bounds + Storage-prefix check) to `sendMessage` —
   see `launch-hardening-todo`.

## Spec sync (kept in sync in the implementing change)

- `docs/specs/page-chat.md` — sends go through the `sendMessage` callable; `senderName`
  is server-stamped, not client-authored.
- `src/lib/firestore/schema.ts` — `Message.senderName` comment notes it is server-derived.
