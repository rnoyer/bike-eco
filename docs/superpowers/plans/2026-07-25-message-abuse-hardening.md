# Message-abuse Hardening (Slice 4c-B1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bound the client-controlled parts of a chat message (text length, attachment count, attachment metadata) and verify each attachment URL points into its own dossier's message folder, so a malicious client cannot store an oversized, empty, or cross-tenant message.

**Architecture:** Server-side hardening in the `sendMessage` callable — Zod schema caps for the statically-checkable limits (`functions/src/messages/schemas.ts`), plus a storage-prefix check in `sendMessageCore` for the dossier-dependent URL check (`functions/src/messages/core.ts`). A client-side cap in the composer keeps the user inside the same limits with friendly French copy.

**Tech Stack:** TypeScript, Zod v4, Firebase Cloud Functions (`firebase-functions/https`), Jest + ts-jest (functions), Jest (app), React Native / Expo (composer).

## Global Constraints

- Branch stacks on `feat/senderName-server-stamping` (slice 4c / PR #11, not yet merged). Do all work on that branch.
- No security-rules changes in this slice. Do not touch `firebase/storage.rules` or `firebase/firestore.rules`.
- No App Check (B2) in this slice — do not add `enforceAppCheck` anywhere.
- UI copy is French. Error/alert copy must be specific and actionable.
- `text` cap: **4096** characters. Attachment array cap: **5**. Attachment `name` cap: **255**. Attachment `size` cap: **10 \* 1024 \* 1024** (10 MB), matching the Storage write rule.
- A `ZodError` from `.parse()` is already mapped to a client `invalid-argument` HttpsError by `toHttps` (`functions/src/callable.ts`); a `RegError(code, message)` is mapped to an HttpsError with that `code`. Reuse both — do not add new error wiring.
- TDD: write the failing test first, watch it fail, implement, watch it pass, commit. Frequent commits.

---

## File Structure

- `functions/src/messages/schemas.ts` (modify) — add the static caps + empty-message refine.
- `functions/src/messages/schemas.test.ts` (create) — schema-level parse tests.
- `functions/src/messages/core.ts` (modify) — add `isAttachmentUnderMessagePrefix` pure helper + per-attachment prefix check in `sendMessageCore`.
- `functions/src/messages/core.test.ts` (modify) — add helper unit tests + prefix-check integration tests.
- `src/components/ui/chat/ChatComposer.tsx` (modify) — `maxLength={4096}` on the input + a 5-attachment guard in `pickPhoto`/`pickPdf`.

Tasks are ordered so each ends with an independently testable, committable deliverable.

---

## Task 1: Schema caps + empty-message rejection

**Files:**
- Modify: `functions/src/messages/schemas.ts`
- Create: `functions/src/messages/schemas.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `sendMessageSchema` (unchanged export name/shape at the type level — `SendMessageInput` type is unchanged; only runtime validation tightens). Later tasks rely on `sendMessageSchema.parse()` still throwing `ZodError` on invalid input.

- [ ] **Step 1: Write the failing tests**

Create `functions/src/messages/schemas.test.ts`:

```ts
import { sendMessageSchema } from "./schemas";

const valid = {
  dossierId: "dos_1",
  messageId: "msg_1",
  text: "Bonjour",
  attachments: [],
};

const attachment = {
  type: "pdf" as const,
  url: "https://x/o/dossiers%2Fc%2Fd%2Fmessages%2Fm%2Foffre.pdf?alt=media",
  name: "offre.pdf",
  size: 1024,
};

test("a valid text-only message parses", () => {
  expect(() => sendMessageSchema.parse(valid)).not.toThrow();
});

test("a valid message with one attachment parses", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, attachments: [attachment] }),
  ).not.toThrow();
});

test("text over 4096 chars is rejected", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "a".repeat(4097) }),
  ).toThrow();
});

test("text of exactly 4096 chars is allowed", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "a".repeat(4096) }),
  ).not.toThrow();
});

test("more than 5 attachments is rejected", () => {
  const six = Array.from({ length: 6 }, () => attachment);
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: six }),
  ).toThrow();
});

test("exactly 5 attachments is allowed", () => {
  const five = Array.from({ length: 5 }, () => attachment);
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: five }),
  ).not.toThrow();
});

test("a fully empty message (no text, no attachments) is rejected", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: [] }),
  ).toThrow();
});

test("whitespace-only text with no attachments is rejected", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "   ", attachments: [] }),
  ).toThrow();
});

test("attachment size over 10 MB is rejected", () => {
  const big = { ...attachment, size: 10 * 1024 * 1024 + 1 };
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: [big] }),
  ).toThrow();
});

test("attachment name over 255 chars is rejected", () => {
  const longName = { ...attachment, name: "a".repeat(256) };
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: [longName] }),
  ).toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npx jest src/messages/schemas.test.ts`
Expected: FAIL — the over-limit / empty-message cases currently parse without throwing (e.g. "text over 4096 chars is rejected" fails because no `.max` exists yet).

- [ ] **Step 3: Apply the schema changes**

Edit `functions/src/messages/schemas.ts` to:

```ts
import { z } from "zod";

const attachmentSchema = z.object({
  type: z.enum(["image", "pdf"]),
  url: z.string().min(1),
  name: z.string().min(1).max(255),
  size: z.number().int().nonnegative().max(10 * 1024 * 1024),
});

export const sendMessageSchema = z
  .object({
    dossierId: z.string().trim().min(1),
    messageId: z.string().trim().min(1),
    text: z.string().max(4096),
    attachments: z.array(attachmentSchema).max(5),
  })
  // Mirror the composer's "nothing to send" guard on the server: a message must
  // carry either non-whitespace text or at least one attachment.
  .refine((v) => v.text.trim().length > 0 || v.attachments.length > 0, {
    message: "Message vide.",
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npx jest src/messages/schemas.test.ts`
Expected: PASS (all 10 tests).

- [ ] **Step 5: Verify the full functions suite + typecheck still pass**

Run: `cd functions && npx tsc --noEmit && npm test`
Expected: PASS. `core.test.ts` still passes — its `input` fixture has non-empty text, so the refine does not reject it.

- [ ] **Step 6: Commit**

```bash
git add functions/src/messages/schemas.ts functions/src/messages/schemas.test.ts
git commit -m "feat(messages): cap message text/attachments; reject empty messages"
```

---

## Task 2: Attachment storage-prefix check in `sendMessageCore`

**Files:**
- Modify: `functions/src/messages/core.ts`
- Modify: `functions/src/messages/core.test.ts`

**Interfaces:**
- Consumes: `SendMessageInput` (Task 1), `SendMessageDeps`, `CallerClaims`, `RegError`.
- Produces: exported pure helper
  `isAttachmentUnderMessagePrefix(url: string, companyId: string, dossierId: string, messageId: string): boolean`.
  `sendMessageCore` now throws `RegError("invalid-argument", "Pièce jointe invalide.")` when any attachment `url` is not under the dossier's own message prefix.

- [ ] **Step 1: Write the failing tests**

Add to `functions/src/messages/core.test.ts`. First add the helper import to the existing top import line:

```ts
import {
  sendMessageCore,
  isAttachmentUnderMessagePrefix,
  type SendMessageDeps,
  type NewMessage,
} from "./core";
```

Then append these tests to the end of the file:

```ts
describe("isAttachmentUnderMessagePrefix", () => {
  const url = (path: string) =>
    `https://firebasestorage.googleapis.com/v0/b/bkt/o/${path}?alt=media&token=abc`;

  test("accepts a url under the exact company/dossier/message prefix", () => {
    const u = url("dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_1%2Foffre.pdf");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(true);
  });

  test("rejects a url under another company's prefix", () => {
    const u = url("dossiers%2Fcomp_2%2Fdos_1%2Fmessages%2Fmsg_1%2Foffre.pdf");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("rejects a url under another dossier's prefix", () => {
    const u = url("dossiers%2Fcomp_1%2Fdos_2%2Fmessages%2Fmsg_1%2Foffre.pdf");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("rejects a url under another message's prefix", () => {
    const u = url("dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_2%2Foffre.pdf");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("rejects a photos-folder url (right dossier, wrong subtree)", () => {
    const u = url("dossiers%2Fcomp_1%2Fdos_1%2Fphotos%2F0.jpg");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });
});

describe("sendMessageCore attachment-prefix enforcement", () => {
  const withAttachment = (path: string): SendMessageInput => ({
    dossierId: "dos_1",
    messageId: "msg_1",
    text: "",
    attachments: [
      {
        type: "pdf",
        url: `https://x/o/${path}?alt=media`,
        name: "offre.pdf",
        size: 1024,
      },
    ],
  });

  test("an attachment under the correct prefix is written", async () => {
    const d = fakeDeps();
    await sendMessageCore(
      withAttachment("dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_1%2Foffre.pdf"),
      dealer,
      d,
    );
    expect(d.written).toHaveLength(1);
    expect(d.written[0].attachments).toHaveLength(1);
  });

  test("an attachment pointing at another company is rejected, nothing written", async () => {
    const d = fakeDeps();
    await expect(
      sendMessageCore(
        withAttachment("dossiers%2Fcomp_2%2Fdos_1%2Fmessages%2Fmsg_1%2Foffre.pdf"),
        dealer,
        d,
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(d.written).toHaveLength(0);
  });
});
```

Note: `fakeDeps`, `dealer`, and the `SendMessageInput` import already exist at the top of `core.test.ts` — reuse them; do not redefine.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd functions && npx jest src/messages/core.test.ts`
Expected: FAIL — `isAttachmentUnderMessagePrefix` is not exported yet (TypeScript/import error), and the "another company is rejected" case would not throw once that compiles.

- [ ] **Step 3: Add the helper and the check to `core.ts`**

In `functions/src/messages/core.ts`, add the exported helper (place it above `sendMessageCore`):

```ts
/**
 * True when a Firebase Storage *download URL* points into this dossier's own
 * message folder. Attachment urls come from `getDownloadURL`, which percent-
 * encodes the object path into the `/o/` segment; companyId/dossierId/messageId
 * are alphanumeric Firestore auto-ids, so only the `/` separators are encoded
 * (as `%2F`). Matching the encoded prefix blocks a crafted url that references
 * another company's, dossier's, or message's Storage object.
 */
export function isAttachmentUnderMessagePrefix(
  url: string,
  companyId: string,
  dossierId: string,
  messageId: string,
): boolean {
  const prefix = `dossiers%2F${companyId}%2F${dossierId}%2Fmessages%2F${messageId}%2F`;
  return url.includes(prefix);
}
```

Then, inside `sendMessageCore`, after the `getDossier` result is confirmed and authorization passes, and **before** the `getUser`/`createMessage` work — insert the attachment check right after the authorization block (after the `if (!isBackoffice && !isOwningDealer)` throw):

```ts
  for (const a of input.attachments) {
    if (!isAttachmentUnderMessagePrefix(a.url, dossier.companyId, input.dossierId, input.messageId)) {
      throw new RegError("invalid-argument", "Pièce jointe invalide.");
    }
  }
```

`RegError` is already imported at the top of `core.ts` (`import { RegError, type CallerClaims } from "../registration/core";`). The check uses `dossier.companyId` (the dossier's authoritative owner), not the caller's claim, so it is correct for both dealer and back-office callers.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd functions && npx jest src/messages/core.test.ts`
Expected: PASS — all existing tests plus the 5 helper tests and 2 integration tests.

- [ ] **Step 5: Verify the full functions suite + typecheck**

Run: `cd functions && npx tsc --noEmit && npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add functions/src/messages/core.ts functions/src/messages/core.test.ts
git commit -m "feat(messages): reject attachments outside the dossier's message folder"
```

---

## Task 3: Composer client-side caps

**Files:**
- Modify: `src/components/ui/chat/ChatComposer.tsx`

**Interfaces:**
- Consumes: existing `ChatComposer` component, its `files` state (`PickedFile[]`), `pickPhoto`, `pickPdf`, and the message `TextInput`.
- Produces: no exported API change. Behavior: input capped at 4096 chars; adding a 6th attachment is blocked with a French alert.

- [ ] **Step 1: Add `maxLength` to the message input**

In `src/components/ui/chat/ChatComposer.tsx`, on the message `<TextInput>` (the one with `placeholder="Votre message"`), add `maxLength={4096}`:

```tsx
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Votre message"
          placeholderTextColor={tokens.colors.muted}
          maxLength={4096}
          multiline
        />
```

- [ ] **Step 2: Add a 5-attachment guard to both pickers**

At the top of `pickPhoto`, immediately after `setSheetOpen(false);`, add:

```tsx
    if (files.length >= 5) {
      Alert.alert("Limite atteinte", "5 pièces jointes maximum par message.");
      return;
    }
```

Add the identical guard at the top of `pickPdf`, immediately after its `setSheetOpen(false);`. (`Alert` and `files` are already in scope — `Alert` is imported from `react-native`, `files` is the component's state.)

- [ ] **Step 3: Typecheck + lint the app**

Run (from repo root): `npx tsc --noEmit && npm run lint`
Expected: PASS, no new errors.

- [ ] **Step 4: Run the app test suite**

Run (from repo root): `npm test`
Expected: PASS (136 tests). The composer has no unit test; the `maxLength` and guard are verified by typecheck/lint and manual use — confirm no regression elsewhere.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/chat/ChatComposer.tsx
git commit -m "feat(chat): cap composer at 4096 chars and 5 attachments"
```

---

## Final Verification

- [ ] **Full functions suite:** `cd functions && npx tsc --noEmit && npm test` — expected PASS (35 prior + new schema/core tests).
- [ ] **Full app suite:** `npm test` from repo root — expected PASS (136).
- [ ] **App typecheck + lint:** `npx tsc --noEmit && npm run lint` — expected clean.
- [ ] Rules suite is **not** run — no rules changed this slice.
- [ ] Confirm the branch is still `feat/senderName-server-stamping` with the three new commits stacked on the design-doc commit.

## Out of scope (do not implement here)

- B2 — App Check enforcement on `sendMessage` + the 6 registration callables, and registering App Check providers in `firebase.core.ts`. Blocked on owner Firebase-console setup; stays in the launch-hardening memo.
