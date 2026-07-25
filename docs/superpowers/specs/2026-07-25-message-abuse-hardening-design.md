# Slice 4c-B1 — Message-abuse hardening on `sendMessage`

**Date:** 2026-07-25
**Status:** Design approved, ready for implementation plan
**Branch:** stacks on `feat/senderName-server-stamping` (slice 4c / PR #11, not yet merged)

## Context

Slice 4c moved message creation server-side: the `sendMessage` callable
(`functions/src/messages/`) is the only writer of `dossiers/*/messages/*`, and
security rules deny client `create`. The callable server-stamps
`senderId`/`senderName`/`senderRole` so the client cannot forge them.

What it does **not** yet do is bound the parts of a message the client still
controls — `text`, the `attachments` array, and each attachment's `url`. This
slice adds that input hardening. It is the "B1" half of the message-abuse
launch-hardening item; the "B2" half (App Check enforcement) is **explicitly out
of scope** here and remains tracked in the launch-hardening memo, because it
cannot deploy until an App Check provider + reCAPTCHA/attestation key are set up
in the Firebase console (owner-dependent), and `enforceAppCheck: true` would
otherwise reject every production call.

## Goals

- A single message cannot carry an unbounded `text` blob, an unbounded number of
  attachments, or attachment metadata claiming nonsense sizes.
- An attachment `url` stored on a message must point into **that dossier's own**
  message folder — a client cannot stamp a message with a `url` referencing
  another company's Storage object.
- The composer stops the user at the limits with friendly French copy, rather
  than letting them compose a message the server will reject.

## Non-goals

- App Check enforcement (`enforceAppCheck`) on `sendMessage` or the registration
  callables — deferred (B2), needs Firebase-console setup.
- Any change to Storage or Firestore security rules. Storage rules already cap
  uploads at 10 MB and restrict content types; message `create` is already
  server-only. This slice changes the callable and the composer only.
- Rate limiting / per-user message quotas — not in scope for this slice.

## Design

### 1. Schema hardening — `functions/src/messages/schemas.ts`

Current:

```ts
const attachmentSchema = z.object({
  type: z.enum(["image", "pdf"]),
  url: z.string().min(1),
  name: z.string().min(1),
  size: z.number().int().nonnegative(),
});

export const sendMessageSchema = z.object({
  dossierId: z.string().trim().min(1),
  messageId: z.string().trim().min(1),
  text: z.string(),
  attachments: z.array(attachmentSchema),
});
```

Changes:

- `text`: `z.string().max(4096)`.
- `attachmentSchema.name`: add `.max(255)` (a defensive ceiling over the client's
  own `sanitizeFileName` 100-char slice — the server must not assume the client
  sanitized).
- `attachmentSchema.size`: add `.max(10 * 1024 * 1024)` to mirror the Storage
  10 MB write rule. **This bounds only the client-supplied `size` *metadata*
  shown in chat, not the real file** — actual bytes are already capped by
  Storage rules at upload time. Cheap belt-and-suspenders against a garbage
  number being persisted.
- `attachments`: `z.array(attachmentSchema).max(5)`.
- Reject a fully-empty message with a top-level refine:
  `.refine(v => v.text.trim().length > 0 || v.attachments.length > 0, { message: "Message vide." })`.
  This mirrors the composer's existing `if (!t && files.length === 0) return;`
  guard on the server side.

A `ZodError` from `.parse()` is already mapped to `invalid-argument` by
`toHttps` (`functions/src/callable.ts`), so no wiring changes are needed.

### 2. Storage-prefix check — `functions/src/messages/core.ts`

The schema cannot check the `url` prefix, because the expected prefix depends on
`dossier.companyId`, which is only known after `getDossier`. So the check lives
in `sendMessageCore`, after the dossier is resolved and authorization passes, and
before `createMessage`.

Attachment `url`s are Firebase Storage **download URLs** produced by
`getDownloadURL` — the object path is percent-encoded into the `/o/` segment, e.g.

```
https://firebasestorage.googleapis.com/v0/b/<bucket>/o/dossiers%2F<companyId>%2F<dossierId>%2Fmessages%2F<messageId>%2F<file>?alt=media&token=...
```

The client uploads each attachment to
`dossiers/{companyId}/{dossierId}/messages/{messageId}/{sanitizedName}`
(`messageAttachmentPath`, `src/lib/storage/paths.ts`). `companyId`, `dossierId`,
and `messageId` are alphanumeric Firestore auto-IDs, so they percent-encode to
themselves — the only encoded characters in the prefix are the `/` separators
(`%2F`, uppercase, as `getDownloadURL` emits).

Add a small **pure helper** (unit-testable, no Firebase imports), e.g.:

```ts
export function isAttachmentUnderMessagePrefix(
  url: string,
  companyId: string,
  dossierId: string,
  messageId: string,
): boolean {
  const prefix =
    `dossiers%2F${companyId}%2F${dossierId}%2Fmessages%2F${messageId}%2F`;
  return url.includes(prefix);
}
```

In `sendMessageCore`, after computing `dossier.companyId` and before writing:

```ts
for (const a of input.attachments) {
  if (!isAttachmentUnderMessagePrefix(a.url, dossier.companyId, input.dossierId, input.messageId)) {
    throw new RegError("invalid-argument", "Pièce jointe invalide.");
  }
}
```

`RegError` maps to a client `invalid-argument` HttpsError via `toHttps`. On
rejection nothing is written (`.create()` is never reached).

> Note on `companyId` source: the prefix is built from `dossier.companyId` (the
> authoritative owner of the dossier), **not** from the caller's `companyId`
> claim. For a dealer these are equal (authorization already enforced it); for
> back-office the claim is null, and the dossier's own companyId is the correct
> path root. Using `dossier.companyId` is correct for both.

### 3. Client cap — `src/components/ui/chat/ChatComposer.tsx`

- Add `maxLength={4096}` to the message `TextInput`.
- In `pickPhoto` and `pickPdf`, before appending, guard on the current count:
  if `files.length >= 5`, show a French `Alert` ("Limite de 5 pièces jointes par
  message.") and return instead of adding. Keeps the user at the same limit the
  server enforces, with clear feedback.

## Testing

- **`functions/src/messages/schemas.test.ts`** (new): valid input parses;
  `text` over 4096 rejected; 6 attachments rejected; empty message (no text,
  no attachments) rejected; whitespace-only text with no attachments rejected;
  `size` over 10 MB rejected. Mirrors the style of
  `functions/src/registration/schemas.test.ts`.
- **`functions/src/messages/core.test.ts`** (extend): an attachment `url` under
  the correct `dossiers%2F<companyId>%2F<dossierId>%2Fmessages%2F<messageId>%2F`
  prefix passes and is written; a `url` under the wrong company / dossier /
  message prefix is rejected with `invalid-argument` and nothing is written.
  Also unit-test `isAttachmentUnderMessagePrefix` directly for the encode-path
  cases.
- **App suite** is unaffected by the declarative `maxLength`; the composer has no
  existing test, and the count guard is exercised manually. Run the full app
  suite (136) to confirm no regressions.
- No security-rules changes, so the rules suite (31) is not affected by this
  slice.

**Commands:**

- App: `npm test`
- Functions: `cd functions && npm test`
- Rules (only if touched — it isn't here):
  `export JAVA_HOME=/usr/local/jdk-26.0.1; export PATH=$JAVA_HOME/bin:$PATH; npm run test:rules`
  (stop the dev emulator on 8080/9199 first)

## Out of scope / follow-ups

- **B2 — App Check enforcement.** Add `enforceAppCheck: true` to `sendMessage`
  and the 6 registration callables, register App Check providers in
  `firebase.core.ts`, after the owner sets up an App Check provider + reCAPTCHA/
  attestation key in the Firebase console. Stays in the launch-hardening memo.
