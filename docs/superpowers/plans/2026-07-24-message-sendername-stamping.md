# Message `senderName` Server-Stamping (Slice 4c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Message.senderName` (and `senderId`/`senderRole`/`createdAt`) server-set via a `sendMessage` Cloud callable, so a b2b dealer can no longer forge the sender label (e.g. impersonate the Bike-eco team) in a chat thread.

**Architecture:** Mirror the 4a/4b callable pattern — a pure `sendMessageCore(input, caller, deps)` under a thin `onCall` wrapper, unit-tested with injected `Deps`. The client keeps uploading attachments to Storage and minting the message id, then calls `sendMessage`; the message-create security rule flips to `allow create: if false` (Admin-SDK-only writes). Shared callable infra (`db`, `callerFrom`, `toHttps`) is lifted out of `registration/index.ts` so a non-registration callable doesn't import from a "registration" module.

**Tech Stack:** Firebase 2nd-gen Cloud Functions (`onCall`), firebase-admin SDK, Zod v4, Firestore security rules, React Native / Expo client, Jest (ts-jest for functions, RN preset for the app), `@firebase/rules-unit-testing`.

## Global Constraints

- **Read the spec first:** `docs/superpowers/specs/2026-07-24-message-sendername-stamping-design.md`.
- **Scope is strictly the `senderName` trust fix.** Do NOT add message-length caps, attachment bounds, or Storage-prefix validation — those are deferred launch-hardening items (`launch-hardening-todo`), not part of 4c.
- **App data lives in the named `bike-eco-db` database**, not `(default)` — server code uses `getFirestore(getApp(), "bike-eco-db")`.
- **UI copy is French**, specific and actionable.
- **Trust-sensitive fields are server-set:** `senderId`, `senderName`, `senderRole`, `createdAt` come from the caller's auth/claims + server reads — never from client input.
- **b2b company name comes from the `companies/{companyId}` doc**, never from `dossier.submitter.companyName` (which is itself client-writable at dossier creation).
- **Commit after each task.** End commit messages with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` trailer.
- **Testing note:** this repo has no functions-side emulator-integration harness (4a/4b used injected-Deps core units + the rules emulator tests + a manual walkthrough). This plan follows that precedent: `sendMessageCore` is covered by core units, the rule flip by `rules.test.ts` (which runs under the emulator via `npm run test:rules`), and the end-to-end callable wiring by the manual walkthrough in Task 6.

---

## File Structure

**Functions (`functions/src/`):**
- Create `messages/schemas.ts` — Zod `sendMessageSchema` + `SendMessageInput`.
- Create `messages/core.ts` — `sendMessageCore`, `SendMessageDeps`, `NewMessage`, `MessageAttachment`.
- Create `messages/core.test.ts` — core unit tests (injected Deps).
- Create `messages/index.ts` — `messageDeps()` (real Firestore reads/write) + the `sendMessage` `onCall`.
- Create `callable.ts` — shared admin init + `db()`, `callerFrom`, `toHttps` (lifted from `registration/index.ts`).
- Modify `registration/index.ts` — import shared infra from `../callable`, drop the local copies.
- Modify `index.ts` — re-export `sendMessage`.

**Rules:**
- Modify `firestore.rules` — message `create` → `if false`.
- Modify `src/lib/firestore/__tests__/rules.test.ts` — flip message-create tests to assert denial; add a read-still-works test.

**Client (`src/`):**
- Create `lib/data/callable.ts` — generic `call<T,R>()` + `frenchError()` (lifted from `lib/data/registration.ts`).
- Create `lib/data/messages.ts` — `callSendMessage()` wrapper.
- Modify `lib/data/registration.ts` — import `call` from `./callable`, drop the local copies.
- Modify `lib/data/useSendMessage.ts` — call the callable instead of `setDoc`; drop `writeWithTimeout`; simplify signature.
- Modify `components/screens/DossierChatScreen.tsx` — drop `formatSenderName`/sender wiring.
- Delete `lib/chat/senderName.ts` and `lib/chat/senderName.test.ts`.
- Modify `lib/firestore/schema.ts` — `Message.senderName` comment.

**Docs:**
- Modify `docs/specs/page-chat.md` — server-stamped `senderName` note.

---

## Task 1: `sendMessageCore` — pure server logic

**Files:**
- Create: `functions/src/messages/schemas.ts`
- Create: `functions/src/messages/core.ts`
- Test: `functions/src/messages/core.test.ts`

**Interfaces:**
- Consumes: `RegError`, `CallerClaims` from `functions/src/registration/core.ts` (`RegError` codes include `"permission-denied"`, `"not-found"`).
- Produces:
  - `sendMessageSchema` (Zod) and `type SendMessageInput = { dossierId: string; messageId: string; text: string; attachments: MessageAttachment[] }`.
  - `interface MessageAttachment { type: "image" | "pdf"; url: string; name: string; size: number }`.
  - `interface NewMessage { senderId: string; senderName: string; senderRole: string; text: string; attachments: MessageAttachment[] }` (no `createdAt` — the real Dep adds it).
  - `interface SendMessageDeps { getDossier(id): Promise<{ companyId: string } | null>; getUser(uid): Promise<{ prenom: string; nom: string } | null>; getCompanyName(companyId): Promise<string | null>; createMessage(dossierId, messageId, data: NewMessage): Promise<void> }`.
  - `sendMessageCore(input: SendMessageInput, caller: CallerClaims, deps: SendMessageDeps): Promise<void>`.

- [ ] **Step 1: Write the schema**

Create `functions/src/messages/schemas.ts`:

```ts
import { z } from "zod";

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

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
```

- [ ] **Step 2: Write the failing core tests**

Create `functions/src/messages/core.test.ts`:

```ts
import { sendMessageCore, type SendMessageDeps, type NewMessage } from "./core";
import type { CallerClaims } from "../registration/core";
import type { SendMessageInput } from "./schemas";

const input: SendMessageInput = {
  dossierId: "dos_1",
  messageId: "msg_1",
  text: "  Bonjour  ",
  attachments: [],
};

const dealer: CallerClaims = { uid: "u1", role: "b2b", status: "active", companyId: "comp_1" };
const backoffice: CallerClaims = { uid: "bo1", role: "backoffice", status: "active", companyId: null };

function fakeDeps(over: Partial<SendMessageDeps> = {}): SendMessageDeps & { written: NewMessage[] } {
  const written: NewMessage[] = [];
  return {
    written,
    getDossier: async () => ({ companyId: "comp_1" }),
    getUser: async () => ({ prenom: "Camille", nom: "Durand" }),
    getCompanyName: async () => "Garage du Nord",
    createMessage: async (_d, _m, data) => { written.push(data); },
    ...over,
  };
}

test("a dealer's message is stamped '[name] - [company]' from the company doc", async () => {
  const d = fakeDeps();
  await sendMessageCore(input, dealer, d);
  expect(d.written).toHaveLength(1);
  expect(d.written[0]).toMatchObject({
    senderId: "u1",
    senderName: "Camille Durand - Garage du Nord",
    senderRole: "b2b",
    text: "Bonjour",
    attachments: [],
  });
});

test("a backoffice message is stamped '[name] - Bike-eco'", async () => {
  const d = fakeDeps({ getUser: async () => ({ prenom: "Alex", nom: "Martin" }) });
  await sendMessageCore(input, backoffice, d);
  expect(d.written[0].senderName).toBe("Alex Martin - Bike-eco");
  expect(d.written[0].senderRole).toBe("backoffice");
});

test("a dealer cannot message on another company's dossier", async () => {
  const d = fakeDeps({ getDossier: async () => ({ companyId: "comp_2" }) });
  await expect(sendMessageCore(input, dealer, d)).rejects.toMatchObject({ code: "permission-denied" });
  expect(d.written).toHaveLength(0);
});

test("a non-active caller is rejected", async () => {
  const d = fakeDeps();
  const pending: CallerClaims = { uid: "u1", role: "b2b", status: "pending", companyId: "comp_1" };
  await expect(sendMessageCore(input, pending, d)).rejects.toMatchObject({ code: "permission-denied" });
});

test("a missing dossier is not-found", async () => {
  const d = fakeDeps({ getDossier: async () => null });
  await expect(sendMessageCore(input, dealer, d)).rejects.toMatchObject({ code: "not-found" });
});

test("a duplicate messageId (createMessage rejects) propagates", async () => {
  const d = fakeDeps({ createMessage: async () => { throw new Error("ALREADY_EXISTS"); } });
  await expect(sendMessageCore(input, dealer, d)).rejects.toThrow("ALREADY_EXISTS");
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd functions && npx jest messages/core.test.ts`
Expected: FAIL — `Cannot find module './core'`.

- [ ] **Step 4: Implement the core**

Create `functions/src/messages/core.ts`:

```ts
import { RegError, type CallerClaims } from "../registration/core";
import type { SendMessageInput } from "./schemas";

export interface MessageAttachment {
  type: "image" | "pdf";
  url: string;
  name: string;
  size: number;
}

export interface NewMessage {
  senderId: string;
  senderName: string;
  senderRole: string;
  text: string;
  attachments: MessageAttachment[];
}

export interface SendMessageDeps {
  getDossier(id: string): Promise<{ companyId: string } | null>;
  getUser(uid: string): Promise<{ prenom: string; nom: string } | null>;
  getCompanyName(companyId: string): Promise<string | null>;
  createMessage(dossierId: string, messageId: string, data: NewMessage): Promise<void>;
}

export async function sendMessageCore(
  input: SendMessageInput,
  caller: CallerClaims,
  deps: SendMessageDeps,
): Promise<void> {
  if (caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée aux comptes actifs.");
  }
  const dossier = await deps.getDossier(input.dossierId);
  if (!dossier) throw new RegError("not-found", "Dossier introuvable.");

  const isBackoffice = caller.role === "backoffice";
  const isOwningDealer = caller.role === "b2b" && caller.companyId === dossier.companyId;
  if (!isBackoffice && !isOwningDealer) {
    throw new RegError("permission-denied", "Action non autorisée sur ce dossier.");
  }

  const user = await deps.getUser(caller.uid);
  if (!user) throw new RegError("not-found", "Utilisateur introuvable.");
  const person = `${user.prenom} ${user.nom}`.trim();

  let senderName: string;
  if (isBackoffice) {
    senderName = `${person} - Bike-eco`;
  } else {
    const companyName = await deps.getCompanyName(caller.companyId!);
    if (!companyName) throw new RegError("not-found", "Entreprise introuvable.");
    senderName = `${person} - ${companyName}`;
  }

  await deps.createMessage(input.dossierId, input.messageId, {
    senderId: caller.uid,
    senderName,
    senderRole: caller.role!,
    text: input.text.trim(),
    attachments: input.attachments,
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd functions && npx jest messages/core.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Lint**

Run: `cd functions && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add functions/src/messages/schemas.ts functions/src/messages/core.ts functions/src/messages/core.test.ts
git commit -m "feat(functions): sendMessageCore — server-derive Message.senderName

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Shared callable infra + `sendMessage` onCall

**Files:**
- Create: `functions/src/callable.ts`
- Create: `functions/src/messages/index.ts`
- Modify: `functions/src/registration/index.ts` (drop local `db`/`callerFrom`/`toHttps`/admin-init; import from `../callable`)
- Modify: `functions/src/index.ts` (re-export `sendMessage`)

**Interfaces:**
- Consumes: `sendMessageCore`, `SendMessageDeps` (Task 1); `RegError`, `CallerClaims` from `registration/core`.
- Produces: `db()`, `callerFrom(req)`, `toHttps(err)` from `../callable`; the deployed `sendMessage` callable (`onCall`) returning `{ ok: true }`.

- [ ] **Step 1: Create the shared callable module**

Create `functions/src/callable.ts` (bodies copied verbatim from the current `registration/index.ts`):

```ts
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { ZodError } from "zod";

import { RegError, type CallerClaims } from "./registration/core";

// Point the admin SDK at the local emulators in dev. Deployed Gen2 functions
// always run with NODE_ENV="production", so this block is skipped in prod.
if (process.env.NODE_ENV !== "production") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
}

// Guard against a double-init across every callable module.
if (!getApps().length) initializeApp();

export const db = () => getFirestore(getApp(), "bike-eco-db");

export function callerFrom(
  req: { auth?: { uid: string; token: Record<string, unknown> } },
): CallerClaims {
  const token = req.auth!.token;
  return {
    uid: req.auth!.uid,
    role: token.role as string,
    status: token.status as string,
    companyId: (token.companyId as string) ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toHttps(err: unknown): never {
  if (err instanceof RegError) throw new HttpsError(err.code, err.message);
  if (err instanceof ZodError) throw new HttpsError("invalid-argument", "Données du formulaire invalides.");

  if (isRecord(err) && typeof err.code === "string") {
    const code = err.code as string;
    if (code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Cette adresse email est déjà utilisée.");
    }
    if (code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Le mot de passe est invalide.");
    }
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error("Callable failed", { error: message });
  throw new HttpsError("internal", "Une erreur est survenue. Veuillez réessayer.");
}
```

- [ ] **Step 2: Point `registration/index.ts` at the shared module**

In `functions/src/registration/index.ts`:

Delete the emulator-env block (the `if (process.env.NODE_ENV !== "production") { ... }`), the `if (!getApps().length) initializeApp();` guard, the `const db = () => ...` line, and the `callerFrom`, `isRecord`, and `toHttps` function definitions.

Update the top imports — remove `getApp, getApps, initializeApp` from `firebase-admin/app`, remove `getFirestore` from `firebase-admin/firestore` (keep `FieldValue, Timestamp`), and remove `import { ZodError } from "zod";` and the `logger` import if now unused. Keep `HttpsError, onCall` and `getAuth`/`getStorage`. Then add:

```ts
import { db, callerFrom, toHttps } from "../callable";
```

(The `getApp` import stays only if still referenced — after removing `db`, it is not; remove it.)

- [ ] **Step 3: Verify registration still type-checks**

Run: `cd functions && npm run build`
Expected: no TS errors (the extraction is behavior-preserving).

- [ ] **Step 4: Create the `sendMessage` onCall + real Deps**

Create `functions/src/messages/index.ts`:

```ts
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/https";

import { callerFrom, db, toHttps } from "../callable";
import { sendMessageCore, type SendMessageDeps } from "./core";
import { sendMessageSchema } from "./schemas";

function messageDeps(): SendMessageDeps {
  return {
    getDossier: async (id) => {
      const snap = await db().collection("dossiers").doc(id).get();
      if (!snap.exists) return null;
      return { companyId: snap.data()!.companyId as string };
    },
    getUser: async (uid) => {
      const snap = await db().collection("users").doc(uid).get();
      if (!snap.exists) return null;
      const d = snap.data()!;
      return { prenom: d.prenom as string, nom: d.nom as string };
    },
    getCompanyName: async (companyId) => {
      const snap = await db().collection("companies").doc(companyId).get();
      return snap.exists ? (snap.data()!.name as string) : null;
    },
    // .create() fails if the doc already exists — a replayed messageId cannot
    // clobber an existing message.
    createMessage: async (dossierId, messageId, data) => {
      await db()
        .collection("dossiers").doc(dossierId)
        .collection("messages").doc(messageId)
        .create({ ...data, createdAt: FieldValue.serverTimestamp() });
    },
  };
}

export const sendMessage = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const input = sendMessageSchema.parse(req.data);
    await sendMessageCore(input, callerFrom(req), messageDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});
```

- [ ] **Step 5: Re-export from the functions entrypoint**

In `functions/src/index.ts`, after the existing `export { ... } from "./registration";` block, add:

```ts
export { sendMessage } from "./messages";
```

- [ ] **Step 6: Build + lint + run the functions test suite**

Run: `cd functions && npm run build && npm run lint && npm test`
Expected: build clean, lint clean, all jest tests pass (including Task 1's `messages/core.test.ts`).

- [ ] **Step 7: Commit**

```bash
git add functions/src/callable.ts functions/src/messages/index.ts functions/src/registration/index.ts functions/src/index.ts
git commit -m "feat(functions): sendMessage callable + shared callable infra

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Client `callable.ts` + `callSendMessage`

**Files:**
- Create: `src/lib/data/callable.ts`
- Create: `src/lib/data/messages.ts`
- Modify: `src/lib/data/registration.ts` (import `call` from `./callable`, drop local copies)

**Interfaces:**
- Consumes: `functions` from `firebase.core`; `MessageAttachment` from `@/lib/firestore/schema`.
- Produces: `call<T,R>(name, data)` and `frenchError(error)` from `./callable`; `callSendMessage(p: SendMessagePayload): Promise<void>` where `SendMessagePayload = { dossierId: string; messageId: string; text: string; attachments: MessageAttachment[] }`.

- [ ] **Step 1: Create the shared client callable module**

Create `src/lib/data/callable.ts` — move the `frenchError`, `messages` map, and `call` from `registration.ts` verbatim (keeps registration's error strings byte-for-byte; the server-authored `message` is preferred when present):

```ts
import { httpsCallable, type FunctionsError } from "firebase/functions";
import { functions } from "../../../firebase.core";

/** Firebase callable errors carry a `code` like "functions/already-exists"; map to French. */
export function frenchError(error: unknown): Error {
  const code = (error as FunctionsError)?.code ?? "";
  const messages: Record<string, string> = {
    "functions/already-exists": "Une entreprise avec ce SIRET est déjà enregistrée.",
    "functions/permission-denied": "Action non autorisée.",
    "functions/not-found": "Code d'invitation invalide ou expiré.",
    "functions/unauthenticated": "Connexion requise.",
    "functions/unavailable": "Connexion impossible. Vérifiez votre réseau.",
    "functions/invalid-argument": "Données du formulaire invalides.",
    "functions/internal": "Une erreur est survenue. Veuillez réessayer.",
    "functions/failed-precondition": "Cette entreprise n'est pas en attente de validation.",
  };
  // A thrown HttpsError message is server-authored French; prefer it when present.
  const serverMsg = (error as { message?: string })?.message;
  return new Error(serverMsg ?? messages[code] ?? "Une erreur est survenue. Veuillez réessayer.");
}

export async function call<T, R>(name: string, data: T): Promise<R> {
  try {
    const fn = httpsCallable<T, R>(functions, name);
    return (await fn(data)).data;
  } catch (error) {
    throw frenchError(error);
  }
}
```

- [ ] **Step 2: Trim `registration.ts` to import the shared helpers**

In `src/lib/data/registration.ts`: delete the `frenchError` function, the local `call` function, and the now-unused `import { httpsCallable, type FunctionsError } from "firebase/functions";` and `import { functions } from "../../../firebase.core";` lines. Add at the top:

```ts
import { call } from "./callable";
```

Everything below (`RegisterCompanyPayload`, `AcceptInvitePayload`, and the `callRegisterCompany`/`callSendInvite`/`callResolveInvite`/`callAcceptInvite`/`callApproveCompany`/`callDeleteCompany` exports) stays unchanged.

- [ ] **Step 3: Add the `callSendMessage` wrapper**

Create `src/lib/data/messages.ts`:

```ts
import type { MessageAttachment } from "@/lib/firestore/schema";
import { call } from "./callable";

export interface SendMessagePayload {
  dossierId: string;
  messageId: string;
  text: string;
  attachments: MessageAttachment[];
}

export const callSendMessage = (p: SendMessagePayload) =>
  call<SendMessagePayload, { ok: true }>("sendMessage", p).then(() => undefined);
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors (registration consumers still import the same `call*` names).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/callable.ts src/lib/data/messages.ts src/lib/data/registration.ts
git commit -m "refactor(data): extract shared callable helper; add callSendMessage

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Rewire `useSendMessage` + `DossierChatScreen`; delete `senderName`

**Files:**
- Modify: `src/lib/data/useSendMessage.ts`
- Modify: `src/components/screens/DossierChatScreen.tsx`
- Delete: `src/lib/chat/senderName.ts`, `src/lib/chat/senderName.test.ts`
- Modify: `src/lib/firestore/schema.ts` (comment)
- Modify: `docs/specs/page-chat.md` (note)

**Interfaces:**
- Consumes: `callSendMessage` (Task 3).
- Produces: `useSendMessage(dossierId: string, companyId: string): { send(text: string, files?: PickedFile[]): Promise<void> }` — the `sender` argument is removed.

- [ ] **Step 1: Rewire `useSendMessage.ts`**

Replace the body of `src/lib/data/useSendMessage.ts` with:

```ts
import { useCallback } from "react";
import { doc } from "firebase/firestore";

import { messagesRef } from "@/lib/firestore/collections";
import type { AttachmentType, MessageAttachment } from "@/lib/firestore/schema";
import { cleanUpOnFailure } from "@/lib/storage/cleanup";
import { messageAttachmentPath, sanitizeFileName } from "@/lib/storage/paths";
import { removeStorageObject, uploadLocalFile } from "@/lib/storage/upload";
import { callSendMessage } from "./messages";
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
 * the document exists. Attachments upload client-side; the message document is
 * written by the `sendMessage` callable, which server-stamps senderId/senderName/
 * senderRole (the client cannot forge them). A failure deletes any attachment
 * already uploaded.
 */
export function useSendMessage(dossierId: string, companyId: string) {
  const send = useCallback(
    async (text: string, files: PickedFile[] = []) => {
      const messageId = doc(messagesRef(dossierId)).id;
      await cleanUpOnFailure(async (track) => {
        const attachments: MessageAttachment[] = [];
        for (const file of files) {
          const path = messageAttachmentPath(companyId, dossierId, messageId, file.name);
          track(path);
          let url: string;
          try {
            url = await uploadLocalFile(file.uri, path, file.mimeType);
          } catch (error) {
            throw new Error(mapDataError((error as { code?: string }).code ?? ""));
          }
          attachments.push({
            type: file.type,
            url,
            name: sanitizeFileName(file.name),
            size: file.size,
          });
        }
        // The callable throws a ready French Error on failure; cleanUpOnFailure
        // removes any uploaded attachments before it propagates.
        await callSendMessage({ dossierId, messageId, text: text.trim(), attachments });
      }, removeStorageObject);
    },
    [dossierId, companyId],
  );

  return { send };
}
```

- [ ] **Step 2: Rewire `DossierChatScreen.tsx`**

In `src/components/screens/DossierChatScreen.tsx`: remove `import { formatSenderName } from "@/lib/chat/senderName";`, and replace the `useSendMessage(...)` call:

```tsx
const { send } = useSendMessage(id, dossier?.companyId ?? "");
```

Keep `useSession()` and the `const { user } = useSession();` line — `user.id` is still passed to `ChatThread currentUserId`, and the `if (!user || !dossier) return null;` guard stays.

- [ ] **Step 3: Delete the dead senderName module**

```bash
git rm src/lib/chat/senderName.ts src/lib/chat/senderName.test.ts
```

- [ ] **Step 4: Update the schema comment**

In `src/lib/firestore/schema.ts`, change the `Message.senderName` line to:

```ts
  senderName: string; // server-derived "[name] - [company]" / "[name] - Bike-eco" (stamped by the sendMessage callable)
```

- [ ] **Step 5: Sync `page-chat.md`**

In `docs/specs/page-chat.md`, add a short note (near the message/sender description) that message sends go through the `sendMessage` Cloud callable and `senderName` is stamped server-side (not client-authored), so the sender label cannot be forged. Match the file's existing heading/prose style.

- [ ] **Step 6: Type-check, lint, run the app test suite**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: no TS/lint errors; jest suite green (the deleted `senderName.test.ts` no longer runs; no test referenced the removed `useSendMessage` `sender` arg).

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/useSendMessage.ts src/components/screens/DossierChatScreen.tsx src/lib/firestore/schema.ts docs/specs/page-chat.md
git commit -m "feat(chat): send via sendMessage callable; drop client senderName

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Flip message-create security rule to server-only

**Files:**
- Modify: `firestore.rules`
- Modify: `src/lib/firestore/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `dossiers/{id}/messages` create is denied to all clients; read is unchanged.

- [ ] **Step 1: Update the failing rules tests first**

In `src/lib/firestore/__tests__/rules.test.ts`, replace the four message tests (the block from `test("a dealer messages on their own dossier", ...)` through the end of `test("backoffice messages on any dossier", ...)`) with:

```ts
test("no client can create a message directly (server-only via sendMessage)", async () => {
  const dealer = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(dealer, "dossiers/dos_1/messages"), newMessage()),
  );
  const bo = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertFails(
    addDoc(
      collection(bo, "dossiers/dos_1/messages"),
      newMessage({ senderId: "bo_1", senderRole: "backoffice" }),
    ),
  );
});

test("a dossier participant can still read messages", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), "dossiers/dos_1/messages/seed_msg"),
      newMessage(),
    );
  });
  const dealer = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertSucceeds(getDoc(doc(dealer, "dossiers/dos_1/messages/seed_msg")));
  const bo = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(getDoc(doc(bo, "dossiers/dos_1/messages/seed_msg")));
  const outsider = env.authenticatedContext("user_b2b_sud", { role: "b2b", companyId: "comp_2", status: "active" }).firestore();
  await assertFails(getDoc(doc(outsider, "dossiers/dos_1/messages/seed_msg")));
});
```

(The `newMessage` helper, `setDoc`, `getDoc`, `assertSucceeds`, and `assertFails` are already imported at the top of the file. `dos_1` belongs to `comp_1`; confirm `user_b2b_sud`/`comp_2` matches the file's existing seed — if the file already defines an outsider identity, reuse it instead.)

- [ ] **Step 2: Run the rules tests to verify the create test fails**

Run: `npm run test:rules`
Expected: the new "no client can create a message directly" test FAILS (current rule still allows a participant create), proving the test bites.

- [ ] **Step 3: Flip the rule**

In `firestore.rules`, replace the `messages` block:

```
      match /messages/{messageId} {
        allow read: if isDossierParticipant(dossierId);
        allow create, update, delete: if false;
      }
```

- [ ] **Step 4: Run the rules tests to verify they pass**

Run: `npm run test:rules`
Expected: PASS — direct client creates denied for both dealer and backoffice; participant reads still succeed; outsider read denied.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/lib/firestore/__tests__/rules.test.ts
git commit -m "feat(rules): message create is server-only (sendMessage callable)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Manual walkthrough + deploy notes

**Files:** none (verification + owner setup).

- [ ] **Step 1: Emulator walkthrough**

Start the emulators (with functions) and the app pointed at them (`EXPO_PUBLIC_USE_EMULATORS=1`). With a seeded active dealer and a backoffice user on a shared dossier:
- Dealer sends a message → it appears in the thread with `senderName` = `"[dealer name] - [company]"`.
- Backoffice sends → `senderName` = `"[name] - Bike-eco"`.
- Attach a photo/pdf → it uploads and the message carries the attachment.
- Confirm a dealer on a different company cannot open/post to this dossier's thread.

- [ ] **Step 2: Record deploy steps in the spec (already captured)**

Confirm `docs/superpowers/specs/2026-07-24-message-sendername-stamping-design.md` "Owner manual setup" is accurate: deploy order is **functions first, then rules** (`firebase deploy --only functions` then `firebase deploy --only firestore:rules`) so the callable exists before direct client writes are forbidden. No indexes, no data migration.

- [ ] **Step 3: Launch-hardening reminder**

Confirm `launch-hardening-todo` memory already lists the deferred `sendMessage` items (App Check enforcement, 4096-char text cap, attachment bounds + Storage-prefix check). No code change here — just verify the item is recorded so it isn't lost.

---

## Self-Review

**Spec coverage:**
- Callable (`sendMessageCore` + `onCall` + Deps) → Tasks 1–2.
- b2b company name from the company doc (Decision 2) → Task 1 (`getCompanyName(caller.companyId)`), Task 2 (`getCompanyName` reads `companies/{id}.name`).
- `.create()` semantics (Decision 5) → Task 2 `createMessage`.
- Shared infra extraction (functions + client) → Tasks 2 and 3.
- Rule flip to `create: if false` → Task 5.
- Client rewire, drop `writeWithTimeout`, simplified signature, delete `senderName.*` → Task 4.
- Spec sync (`page-chat.md`, schema comment) → Task 4. Deploy/hardening notes → Task 6.
- Deferred items (length/attachment limits, App Check) explicitly out of scope → Global Constraints + Task 6 Step 3.

**Placeholder scan:** none — every code step carries full code; every command has an expected result.

**Type consistency:** `SendMessageDeps`/`NewMessage`/`SendMessageInput` defined in Task 1 are consumed unchanged in Task 2; `call`/`frenchError` defined in Task 3 consumed by `registration.ts` and `messages.ts`; `callSendMessage`/`SendMessagePayload` defined in Task 3 consumed by Task 4's `useSendMessage`; `useSendMessage(dossierId, companyId)` signature in Task 4 matches its `DossierChatScreen` call site.
