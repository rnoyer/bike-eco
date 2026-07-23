# Slice 4a — Registration Flows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real company/invited registration + invite-a-colleague — Cloud Functions that create Firebase Auth users, set claims, and issue one-time invite codes, wired to the existing forms with email/password and Google.

**Architecture:** Four 2nd-gen `onCall` functions whose logic lives in **pure, dependency-injected core functions** (unit-tested with fakes) behind thin wrappers that bind the Admin SDK + nodemailer. The client gets a callable layer + Google sign-in wiring; `AuthProvider` gains `refreshSession()` so the Google path (claims set after sign-in) updates the session.

**Tech Stack:** Expo SDK 56 / RN 0.85, Firebase JS SDK 12, `@react-native-google-signin/google-signin` 16 (already installed); functions: `firebase-functions@7` (2nd-gen), `firebase-admin@13`, `zod@4`, `nodemailer` on Node 24.

**Spec:** `docs/superpowers/specs/2026-07-23-registration-flows-design.md`

## Global Constraints

- **Approach A (hybrid auth):** email/password → the callable creates the Auth user (Admin SDK) atomically; Google → client signs in first, then the **authenticated** callable writes docs + sets claims for `request.auth.uid`.
- **Named database:** functions read/write the **`bike-eco-db`** database — `getFirestore(getApp(), "bike-eco-db")` from `firebase-admin/firestore`, never the default. Client `db` is unchanged.
- **Invite code:** 6 chars, uppercase `A–Z` + `0–9`, **1-hour** expiry, one-time. Only the **hash** is stored (`Invitation.tokenHash`); the raw code is emailed and never logged.
- **Invitation lifecycle:** deleted on acceptance and on encountering expiry; `INVITATION_STATUSES` trims to `["pending"]`.
- **Claims are server-set** (`role`/`companyId`/`status`) via `admin.auth().setCustomUserClaims`, never client-writable. After registration the client force-refreshes (`getIdToken(true)` / `refreshSession()`).
- **Invited users → `active`; company registrants → `pending`.** SIRET must be unique across pending/active companies.
- French UI copy; errors specific & actionable. Client callable errors map to French via a small mapper (reuse the `mapDataError` style).
- Gate each task: from repo root `npx tsc --noEmit && npm run lint && npx jest`; for functions tasks also `cd functions && npm run build && npm run lint && npm test`.
- Pure logic (client or functions) must be unit-testable without Firebase: inject dependencies; no `admin`/`firebaseConfig` imports in `*core*`/helper modules. `import type` is erased and safe.
- The Google button on sign-in + both registration forms is wired; **Apple/Facebook stay disabled** ("bientôt disponible").

---

## Task 1: Functions — jest setup + invite-code helpers (pure, TDD)

**Files:**
- Create: `functions/jest.config.js`, `functions/src/registration/inviteCode.ts`, `functions/src/registration/inviteCode.test.ts`
- Modify: `functions/package.json` (devDeps + `test` script)

**Interfaces:**
- Produces:
  - `generateInviteCode(random?: () => number): string` — 6 chars from `A–Z0–9`.
  - `hashInviteCode(code: string): string` — sha256 hex of the uppercased code.
  - `normalizeInviteCode(input: string): string` — trim + uppercase.
  - `INVITE_TTL_MS = 3_600_000`.

- [ ] **Step 1: Add jest + ts-jest to functions**

Run:
```sh
cd functions && npm install -D jest@^29 ts-jest@^29 @types/jest@^29 && cd ..
```
Then in `functions/package.json`, add to `scripts`: `"test": "jest"`.

- [ ] **Step 2: jest config**

Create `functions/jest.config.js`:
```js
/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
};
```

- [ ] **Step 3: Write the failing test**

Create `functions/src/registration/inviteCode.test.ts`:
```ts
import {
  generateInviteCode,
  hashInviteCode,
  normalizeInviteCode,
} from "./inviteCode";

test("generateInviteCode is 6 uppercase alphanumerics", () => {
  for (let i = 0; i < 50; i++) {
    expect(generateInviteCode()).toMatch(/^[A-Z0-9]{6}$/);
  }
});

test("generateInviteCode maps the RNG deterministically", () => {
  // random() = 0 -> first symbol 'A'; a hair under 1 -> last symbol '9'.
  expect(generateInviteCode(() => 0)).toBe("AAAAAA");
  expect(generateInviteCode(() => 0.999999)).toBe("999999");
});

test("normalizeInviteCode trims and uppercases", () => {
  expect(normalizeInviteCode("  a1b2c3 ")).toBe("A1B2C3");
});

test("hashInviteCode is stable, hex, and case-insensitive on input", () => {
  const h = hashInviteCode("A1B2C3");
  expect(h).toMatch(/^[0-9a-f]{64}$/);
  expect(hashInviteCode("a1b2c3")).toBe(h);
});
```

- [ ] **Step 4: Run it — fails (module missing)**

Run: `cd functions && npm test -- inviteCode && cd ..`
Expected: FAIL — cannot find `./inviteCode`.

- [ ] **Step 5: Implement `inviteCode.ts`**

Create `functions/src/registration/inviteCode.ts`:
```ts
import { createHash } from "crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 36 symbols
const CODE_LENGTH = 6;

/** One hour, in ms — an invitation's lifetime. */
export const INVITE_TTL_MS = 3_600_000;

/** A 6-char uppercase-alphanumeric code. `random` is injectable for tests. */
export function generateInviteCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    const idx = Math.min(ALPHABET.length - 1, Math.floor(random() * ALPHABET.length));
    code += ALPHABET[idx];
  }
  return code;
}

/** Trim + uppercase what a user typed, so lookups are case-insensitive. */
export function normalizeInviteCode(input: string): string {
  return input.trim().toUpperCase();
}

/** sha256 hex of the normalized code. We store this, never the raw code. */
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(normalizeInviteCode(code)).digest("hex");
}
```

- [ ] **Step 6: Run it — passes**

Run: `cd functions && npm test -- inviteCode && cd ..`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add functions/jest.config.js functions/package.json functions/package-lock.json functions/src/registration/inviteCode.ts functions/src/registration/inviteCode.test.ts
git commit -m "feat(functions): invite-code helpers + jest setup"
```

---

## Task 2: Functions — zod payload schemas (pure, TDD)

**Files:**
- Create: `functions/src/registration/schemas.ts`, `functions/src/registration/schemas.test.ts`

**Interfaces:**
- Produces (zod schemas + inferred types):
  - `registerCompanySchema` → `{ method: "password" | "google", siret, companyName, nom, prenom, telephone, departement, ville, email?, password? }`
  - `acceptInviteSchema` → `{ method: "password" | "google", code, nom, prenom, telephone, departement, ville, password? }`
  - `sendInviteSchema` → `{ email }`
  - `resolveInviteSchema` → `{ code }`
  - Types `RegisterCompanyInput`, `AcceptInviteInput`, `SendInviteInput`, `ResolveInviteInput`.

- [ ] **Step 1: Write the failing test**

Create `functions/src/registration/schemas.test.ts`:
```ts
import { registerCompanySchema, sendInviteSchema } from "./schemas";

const base = {
  method: "password" as const,
  siret: "12345678901234",
  companyName: "Garage X",
  nom: "Durand",
  prenom: "Camille",
  telephone: "0600000000",
  departement: "75 - Paris",
  ville: "Paris",
  email: "c@x.fr",
  password: "password123",
};

test("password company registration requires email + password", () => {
  expect(registerCompanySchema.safeParse(base).success).toBe(true);
  const { email, password, ...noCreds } = base;
  expect(registerCompanySchema.safeParse({ ...noCreds }).success).toBe(false);
});

test("google company registration does not require email/password", () => {
  const { email, password, ...rest } = base;
  const parsed = registerCompanySchema.safeParse({ ...rest, method: "google" });
  expect(parsed.success).toBe(true);
});

test("siret must be exactly 14 digits", () => {
  expect(registerCompanySchema.safeParse({ ...base, siret: "123" }).success).toBe(false);
});

test("sendInvite needs a valid email", () => {
  expect(sendInviteSchema.safeParse({ email: "a@b.fr" }).success).toBe(true);
  expect(sendInviteSchema.safeParse({ email: "nope" }).success).toBe(false);
});
```

- [ ] **Step 2: Run it — fails**

Run: `cd functions && npm test -- schemas && cd ..`
Expected: FAIL — cannot find `./schemas`.

- [ ] **Step 3: Implement `schemas.ts`**

Create `functions/src/registration/schemas.ts`:
```ts
import { z } from "zod";

const profile = {
  nom: z.string().trim().min(1),
  prenom: z.string().trim().min(1),
  telephone: z.string().regex(/^\d{10}$/),
  departement: z.string().trim().min(1),
  ville: z.string().trim().min(1),
};

// Password mode carries the credentials; Google mode takes identity from auth.
const credential = z.discriminatedUnion("method", [
  z.object({ method: z.literal("password"), email: z.email(), password: z.string().min(8) }),
  z.object({ method: z.literal("google") }),
]);

export const registerCompanySchema = z
  .object({
    siret: z.string().regex(/^\d{14}$/),
    companyName: z.string().trim().min(1),
    ...profile,
  })
  .and(credential);

export const acceptInviteSchema = z
  .object({ code: z.string().trim().min(1), ...profile })
  .and(credential);

export const sendInviteSchema = z.object({ email: z.email() });
export const resolveInviteSchema = z.object({ code: z.string().trim().min(1) });

export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type SendInviteInput = z.infer<typeof sendInviteSchema>;
export type ResolveInviteInput = z.infer<typeof resolveInviteSchema>;
```

- [ ] **Step 4: Run it — passes**

Run: `cd functions && npm test -- schemas && cd ..`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/registration/schemas.ts functions/src/registration/schemas.test.ts
git commit -m "feat(functions): zod payload schemas for registration"
```

---

## Task 3: Functions — core logic (pure, dependency-injected, TDD)

The heart of the four flows, written against small injected interfaces so it is
unit-tested with fakes (no Admin SDK, no emulator).

**Files:**
- Create: `functions/src/registration/core.ts`, `functions/src/registration/core.test.ts`

**Interfaces:**
- Consumes: `inviteCode.ts`, `schemas.ts` (Task 1–2).
- Produces (all take a `Deps` object as the last arg):
  - `interface Deps` — `createUser(email,password) => Promise<string>` (uid); `setClaims(uid, claims) => Promise<void>`; `companyExistsForSiret(siret) => Promise<boolean>`; `writeCompany(id, data)`, `writeUser(uid, data)`; `newCompanyId() => string`; `findInvitationByHash(hash) => Promise<StoredInvitation | null>`; `deleteInvitation(id)`; `writeInvitation(id, data)`; `now() => number`; `sendApplicantEmail(to, companyName)`, `sendInviteEmail(to, code)`.
  - `registerCompanyCore(input, authUid: string | null, authEmail: string | null, deps): Promise<void>`
  - `sendInviteCore(input, caller: CallerClaims, deps): Promise<void>`
  - `resolveInviteCore(input, deps): Promise<{ email: string; companyName: string }>`
  - `acceptInviteCore(input, authUid, authEmail, deps): Promise<void>`
  - Throws `RegError` (`{ code: "unauthenticated"|"permission-denied"|"already-exists"|"invalid-argument"|"not-found", message }`) for the wrapper to translate to `HttpsError`.

- [ ] **Step 1: Write the failing test**

Create `functions/src/registration/core.test.ts`:
```ts
import {
  acceptInviteCore,
  registerCompanyCore,
  resolveInviteCore,
  sendInviteCore,
  RegError,
  type Deps,
} from "./core";
import { hashInviteCode } from "./inviteCode";

function fakeDeps(over: Partial<Deps> = {}): Deps & { calls: any } {
  const calls: any = { companies: {}, users: {}, invitations: {}, emails: [] };
  return {
    calls,
    createUser: async () => "uid_new",
    setClaims: async (uid, claims) => { calls.claims = { uid, claims }; },
    companyExistsForSiret: async () => false,
    writeCompany: async (id, data) => { calls.companies[id] = data; },
    writeUser: async (uid, data) => { calls.users[uid] = data; },
    newCompanyId: () => "comp_new",
    findInvitationByHash: async () => null,
    deleteInvitation: async (id) => { calls.invitations[id] = "deleted"; },
    writeInvitation: async (id, data) => { calls.invitations[id] = data; },
    now: () => 1_000_000,
    sendApplicantEmail: async (to, name) => { calls.emails.push({ kind: "applicant", to, name }); },
    sendInviteEmail: async (to, code) => { calls.emails.push({ kind: "invite", to, code }); },
    ...over,
  };
}

const companyInput = {
  method: "password" as const, siret: "12345678901234", companyName: "Garage X",
  nom: "Durand", prenom: "Camille", telephone: "0600000000",
  departement: "75 - Paris", ville: "Paris", email: "c@x.fr", password: "password123",
};

test("registerCompany (password) creates pending company+user, pins claims, emails applicant", async () => {
  const d = fakeDeps();
  await registerCompanyCore(companyInput, null, null, d);
  expect(d.calls.companies["comp_new"]).toMatchObject({ siret: "12345678901234", status: "pending", createdBy: "uid_new" });
  expect(d.calls.users["uid_new"]).toMatchObject({ role: "b2b", companyId: "comp_new", status: "pending" });
  expect(d.calls.claims).toEqual({ uid: "uid_new", claims: { role: "b2b", companyId: "comp_new", status: "pending" } });
  expect(d.calls.emails).toEqual([{ kind: "applicant", to: "c@x.fr", name: "Garage X" }]);
});

test("registerCompany rejects a duplicate SIRET", async () => {
  const d = fakeDeps({ companyExistsForSiret: async () => true });
  await expect(registerCompanyCore(companyInput, null, null, d)).rejects.toMatchObject({ code: "already-exists" });
});

test("registerCompany (google) uses the authed uid + email, no createUser", async () => {
  const { email, password, ...rest } = companyInput;
  const d = fakeDeps({ createUser: async () => { throw new Error("must not be called"); } });
  await registerCompanyCore({ ...rest, method: "google" }, "uid_g", "g@x.fr", d);
  expect(d.calls.users["uid_g"]).toBeDefined();
  expect(d.calls.claims.uid).toBe("uid_g");
});

test("sendInvite writes a hashed, 1h invitation for an active b2b caller", async () => {
  const d = fakeDeps();
  await sendInviteCore({ email: "new@x.fr" }, { role: "b2b", status: "active", companyId: "comp_1", uid: "u1" }, d);
  const [id] = Object.keys(d.calls.invitations);
  expect(d.calls.invitations[id]).toMatchObject({ email: "new@x.fr", companyId: "comp_1", invitedBy: "u1", status: "pending", expiresAt: 1_000_000 + 3_600_000 });
  expect(d.calls.invitations[id].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  expect(d.calls.emails[0]).toMatchObject({ kind: "invite", to: "new@x.fr" });
});

test("sendInvite refuses a non-active or non-b2b caller", async () => {
  const d = fakeDeps();
  await expect(sendInviteCore({ email: "x@x.fr" }, { role: "b2b", status: "pending", companyId: "c", uid: "u" }, d)).rejects.toMatchObject({ code: "permission-denied" });
});

test("resolveInvite returns the email for a valid code and deletes an expired one", async () => {
  const good = { id: "inv1", email: "new@x.fr", companyId: "comp_1", companyName: "Garage X", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  const d = fakeDeps({ findInvitationByHash: async (h) => (h === good.tokenHash ? good : null) });
  await expect(resolveInviteCore({ code: "a1b2c3" }, d)).resolves.toEqual({ email: "new@x.fr", companyName: "Garage X" });

  const expired = { ...good, expiresAt: 500_000 };
  const d2 = fakeDeps({ findInvitationByHash: async () => expired });
  await expect(resolveInviteCore({ code: "A1B2C3" }, d2)).rejects.toMatchObject({ code: "not-found" });
  expect(d2.calls.invitations["inv1"]).toBe("deleted");
});

test("acceptInvite creates an ACTIVE user in the invitation's company and deletes the invite", async () => {
  const inv = { id: "inv1", email: "new@x.fr", companyId: "comp_1", companyName: "G", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore({ method: "password", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000", departement: "75 - Paris", ville: "Paris", password: "password123" }, null, null, d);
  expect(d.calls.users["uid_new"]).toMatchObject({ role: "b2b", companyId: "comp_1", status: "active" });
  expect(d.calls.claims.claims.status).toBe("active");
  expect(d.calls.invitations["inv1"]).toBe("deleted");
});

test("acceptInvite (google) requires the Google email to match the invitation", async () => {
  const inv = { id: "inv1", email: "new@x.fr", companyId: "comp_1", companyName: "G", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await expect(acceptInviteCore({ method: "google", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000", departement: "75 - Paris", ville: "Paris" }, "uid_g", "other@x.fr", d)).rejects.toMatchObject({ code: "permission-denied" });
});
```

- [ ] **Step 2: Run it — fails**

Run: `cd functions && npm test -- core && cd ..`
Expected: FAIL — cannot find `./core`.

- [ ] **Step 3: Implement `core.ts`**

Create `functions/src/registration/core.ts`:
```ts
import { generateInviteCode, hashInviteCode, INVITE_TTL_MS } from "./inviteCode";
import type {
  AcceptInviteInput,
  RegisterCompanyInput,
  ResolveInviteInput,
  SendInviteInput,
} from "./schemas";

export type RegErrorCode =
  | "unauthenticated" | "permission-denied" | "already-exists"
  | "invalid-argument" | "not-found";

export class RegError extends Error {
  constructor(public code: RegErrorCode, message: string) {
    super(message);
  }
}

export interface CallerClaims {
  uid: string;
  role?: string;
  status?: string;
  companyId?: string | null;
}

export interface StoredInvitation {
  id: string;
  email: string;
  companyId: string;
  companyName: string;
  tokenHash: string;
  expiresAt: number; // epoch ms
}

export interface Deps {
  createUser(email: string, password: string): Promise<string>;
  setClaims(uid: string, claims: Record<string, unknown>): Promise<void>;
  companyExistsForSiret(siret: string): Promise<boolean>;
  writeCompany(id: string, data: Record<string, unknown>): Promise<void>;
  writeUser(uid: string, data: Record<string, unknown>): Promise<void>;
  newCompanyId(): string;
  findInvitationByHash(hash: string): Promise<StoredInvitation | null>;
  writeInvitation(id: string, data: Record<string, unknown>): Promise<void>;
  deleteInvitation(id: string): Promise<void>;
  now(): number;
  sendApplicantEmail(to: string, companyName: string): Promise<void>;
  sendInviteEmail(to: string, code: string): Promise<void>;
}

function profileDoc(input: { nom: string; prenom: string; telephone: string; departement: string; ville: string }, email: string, companyId: string, status: "pending" | "active") {
  return {
    role: "b2b", companyId, region: null,
    nom: input.nom, prenom: input.prenom, email,
    telephone: input.telephone, departement: input.departement, ville: input.ville,
    status,
  };
}

export async function registerCompanyCore(
  input: RegisterCompanyInput,
  authUid: string | null,
  authEmail: string | null,
  deps: Deps,
): Promise<void> {
  if (await deps.companyExistsForSiret(input.siret)) {
    throw new RegError("already-exists", "Une entreprise avec ce SIRET est déjà enregistrée.");
  }
  let uid: string;
  let email: string;
  if (input.method === "password") {
    uid = await deps.createUser(input.email, input.password);
    email = input.email;
  } else {
    if (!authUid || !authEmail) throw new RegError("unauthenticated", "Connexion Google requise.");
    uid = authUid;
    email = authEmail;
  }
  const companyId = deps.newCompanyId();
  await deps.writeCompany(companyId, {
    siret: input.siret, name: input.companyName, status: "pending", createdBy: uid,
  });
  await deps.writeUser(uid, profileDoc(input, email, companyId, "pending"));
  await deps.setClaims(uid, { role: "b2b", companyId, status: "pending" });
  await deps.sendApplicantEmail(email, input.companyName);
}

export async function sendInviteCore(
  input: SendInviteInput,
  caller: CallerClaims,
  deps: Deps,
): Promise<void> {
  if (caller.role !== "b2b" || caller.status !== "active" || !caller.companyId) {
    throw new RegError("permission-denied", "Seul un compte vendeur actif peut inviter.");
  }
  const code = generateInviteCode();
  const id = deps.newCompanyId(); // reuse the id generator for a random doc id
  await deps.writeInvitation(id, {
    email: input.email, companyId: caller.companyId, invitedBy: caller.uid,
    tokenHash: hashInviteCode(code), status: "pending", expiresAt: deps.now() + INVITE_TTL_MS,
  });
  await deps.sendInviteEmail(input.email, code);
}

export async function resolveInviteCore(
  input: ResolveInviteInput,
  deps: Deps,
): Promise<{ email: string; companyName: string }> {
  const inv = await deps.findInvitationByHash(hashInviteCode(input.code));
  if (!inv) throw new RegError("not-found", "Code d'invitation invalide ou expiré.");
  if (inv.expiresAt <= deps.now()) {
    await deps.deleteInvitation(inv.id);
    throw new RegError("not-found", "Code d'invitation invalide ou expiré.");
  }
  return { email: inv.email, companyName: inv.companyName };
}

export async function acceptInviteCore(
  input: AcceptInviteInput,
  authUid: string | null,
  authEmail: string | null,
  deps: Deps,
): Promise<void> {
  const inv = await deps.findInvitationByHash(hashInviteCode(input.code));
  if (!inv || inv.expiresAt <= deps.now()) {
    if (inv) await deps.deleteInvitation(inv.id);
    throw new RegError("not-found", "Code d'invitation invalide ou expiré.");
  }
  let uid: string;
  if (input.method === "password") {
    uid = await deps.createUser(inv.email, input.password!);
  } else {
    if (!authUid || !authEmail) throw new RegError("unauthenticated", "Connexion Google requise.");
    if (authEmail.toLowerCase() !== inv.email.toLowerCase()) {
      throw new RegError("permission-denied", "Ce compte Google ne correspond pas à l'invitation.");
    }
    uid = authUid;
  }
  await deps.writeUser(uid, profileDoc(input, inv.email, inv.companyId, "active"));
  await deps.setClaims(uid, { role: "b2b", companyId: inv.companyId, status: "active" });
  await deps.deleteInvitation(inv.id);
}
```

> Note: `password!` is safe — the `password` method branch guarantees it via the schema's discriminated union.

- [ ] **Step 4: Run it — passes**

Run: `cd functions && npm test -- core && cd ..`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add functions/src/registration/core.ts functions/src/registration/core.test.ts
git commit -m "feat(functions): pure registration core logic with injected deps"
```

---

## Task 4: Functions — email templates + wrappers wiring the Admin SDK

**Files:**
- Create: `functions/src/registration/emails.ts`, `functions/src/registration/index.ts`
- Modify: `functions/src/email.ts` (export a reusable `sendMail` + secrets), `functions/src/index.ts` (export the callables)

**Interfaces:**
- Consumes: `core.ts`, `schemas.ts`, `email.ts`.
- Produces (deployed callables): `registerCompany`, `sendInvite`, `resolveInvite`, `acceptInvite`.

- [ ] **Step 1: Export a reusable mail sender from `email.ts`**

`functions/src/email.ts` already builds a nodemailer transport for the B2C emails. Add a small exported helper so registration reuses the same transport + secrets. Append:
```ts
/** Reusable single-email sender for non-B2C flows (registration). Same transport + secrets. */
export async function sendMail(opts: { to: string; subject: string; text: string }): Promise<void> {
  const transport = buildTransport(); // the existing internal transport builder
  await transport.sendMail({ from: fromAddress(), to: DEV_EMAIL_OVERRIDE ? DEV_EMAIL : opts.to, subject: opts.subject, text: opts.text });
}
```
If `buildTransport` is not already a named function in `email.ts`, extract the transport-creation code the B2C path uses into `function buildTransport() { … }` and call it from both. Keep `B2C_EMAIL_SECRETS` (the registration callables reuse the same secret list).

- [ ] **Step 2: Registration email copy**

Create `functions/src/registration/emails.ts`:
```ts
import { sendMail } from "../email";

export async function sendApplicantEmail(to: string, companyName: string): Promise<void> {
  await sendMail({
    to,
    subject: "Bike-eco — Demande d'inscription reçue",
    text:
      `Bonjour,\n\nVotre demande d'inscription pour ${companyName} a bien été reçue. ` +
      `Elle est en attente de validation par notre équipe. Vous recevrez un email ` +
      `dès que votre compte sera activé.\n\nL'équipe Bike-eco`,
  });
}

export async function sendInviteEmail(to: string, code: string): Promise<void> {
  await sendMail({
    to,
    subject: "Bike-eco — Vous êtes invité",
    text:
      `Bonjour,\n\nVous avez été invité à rejoindre une entreprise sur Bike-eco. ` +
      `Ouvrez l'application, choisissez "J'ai un code d'invitation" et saisissez ce code :\n\n` +
      `    ${code}\n\nCe code est valable 1 heure.\n\nL'équipe Bike-eco`,
  });
}
```

- [ ] **Step 3: The callable wrappers**

Create `functions/src/registration/index.ts`:
```ts
import { getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/https";

import { B2C_EMAIL_SECRETS } from "../email";
import { sendApplicantEmail, sendInviteEmail } from "./emails";
import {
  acceptInviteCore, registerCompanyCore, resolveInviteCore, sendInviteCore,
  RegError, type Deps, type StoredInvitation,
} from "./core";
import {
  acceptInviteSchema, registerCompanySchema, resolveInviteSchema, sendInviteSchema,
} from "./schemas";

const db = () => getFirestore(getApp(), "bike-eco-db");

function realDeps(): Deps {
  return {
    createUser: async (email, password) => (await getAuth().createUser({ email, password })).uid,
    setClaims: (uid, claims) => getAuth().setCustomUserClaims(uid, claims),
    companyExistsForSiret: async (siret) =>
      !(await db().collection("companies").where("siret", "==", siret).limit(1).get()).empty,
    writeCompany: async (id, data) =>
      void (await db().collection("companies").doc(id).set({ ...data, createdAt: FieldValue.serverTimestamp() })),
    writeUser: async (uid, data) =>
      void (await db().collection("users").doc(uid).set({ ...data, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })),
    newCompanyId: () => db().collection("companies").doc().id,
    findInvitationByHash: async (hash) => {
      const snap = await db().collection("invitations").where("tokenHash", "==", hash).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      const d = doc.data();
      return {
        id: doc.id, email: d.email, companyId: d.companyId, tokenHash: d.tokenHash,
        companyName: (await db().collection("companies").doc(d.companyId).get()).data()?.name ?? "",
        expiresAt: d.expiresAt.toMillis(),
      } satisfies StoredInvitation;
    },
    writeInvitation: async (id, data) =>
      void (await db().collection("invitations").doc(id).set({ ...data, createdAt: FieldValue.serverTimestamp() })),
    deleteInvitation: async (id) => void (await db().collection("invitations").doc(id).delete()),
    now: () => Date.now(),
    sendApplicantEmail,
    sendInviteEmail,
  };
}

function toHttps(err: unknown): never {
  if (err instanceof RegError) throw new HttpsError(err.code, err.message);
  throw new HttpsError("internal", "Une erreur est survenue. Veuillez réessayer.");
}

export const registerCompany = onCall({ secrets: B2C_EMAIL_SECRETS }, async (req) => {
  const input = registerCompanySchema.parse(req.data);
  try {
    await registerCompanyCore(input, req.auth?.uid ?? null, req.auth?.token.email ?? null, realDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const sendInvite = onCall({ secrets: B2C_EMAIL_SECRETS }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  const input = sendInviteSchema.parse(req.data);
  try {
    await sendInviteCore(input, {
      uid: req.auth.uid, role: req.auth.token.role as string,
      status: req.auth.token.status as string, companyId: req.auth.token.companyId as string,
    }, realDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const resolveInvite = onCall(async (req) => {
  const input = resolveInviteSchema.parse(req.data);
  try { return await resolveInviteCore(input, realDeps()); }
  catch (e) { toHttps(e); }
});

export const acceptInvite = onCall({ secrets: B2C_EMAIL_SECRETS }, async (req) => {
  const input = acceptInviteSchema.parse(req.data);
  try {
    await acceptInviteCore(input, req.auth?.uid ?? null, req.auth?.token.email ?? null, realDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});
```

- [ ] **Step 4: Export the callables**

In `functions/src/index.ts`, add near the other exports:
```ts
export { registerCompany, sendInvite, resolveInvite, acceptInvite } from "./registration";
```

- [ ] **Step 5: Build + lint**

Run: `cd functions && npm run build && npm run lint && npm test && cd ..`
Expected: tsc build clean, lint clean, all unit tests pass. (The wrappers have no unit test — they are thin Admin-SDK bindings, exercised in the Task 13 walkthrough.)

- [ ] **Step 6: Commit**

```bash
git add functions/src/email.ts functions/src/registration/emails.ts functions/src/registration/index.ts functions/src/index.ts
git commit -m "feat(functions): registration callables + emails wiring the Admin SDK"
```

---

## Task 5: App — callable client + French error mapping

**Files:**
- Modify: `firebase.core.ts` (add `functions` + emulator wiring)
- Create: `src/lib/data/registration.ts`

**Interfaces:**
- Produces:
  - `functions` export (client `Functions` instance, emulator-wired in dev).
  - `callRegisterCompany(payload) => Promise<void>`, `callSendInvite(email) => Promise<void>`, `callResolveInvite(code) => Promise<{ email; companyName }>`, `callAcceptInvite(payload) => Promise<void>` — each throws an `Error` with French `message` on failure.

- [ ] **Step 1: Add the functions client + emulator wiring**

In `firebase.core.ts`, add the import and export:
```ts
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
```
After `export const storage = getStorage(app);` add:
```ts
export const functions = getFunctions(app, "europe-west9");
```
> `europe-west9` matches the Firestore location; 2nd-gen functions default to `us-central1` unless deployed elsewhere — set the functions' region to `europe-west9` in Task 4's `onCall` options if you want them co-located, OR use the default region here. Use whichever region the functions are actually deployed to; for the emulator the region is ignored.

In `connectDataEmulators()`, after the storage line add:
```ts
  connectFunctionsEmulator(functions, host, 5001);
```

- [ ] **Step 2: Client callable wrappers**

Create `src/lib/data/registration.ts`:
```ts
import { httpsCallable, type HttpsError } from "firebase/functions";
import { functions } from "../../../firebase.core";

/** Firebase callable errors carry a `code` like "functions/already-exists"; map to French. */
function frenchError(error: unknown): Error {
  const code = (error as HttpsError)?.code ?? "";
  const messages: Record<string, string> = {
    "functions/already-exists": "Une entreprise avec ce SIRET est déjà enregistrée.",
    "functions/permission-denied": "Action non autorisée.",
    "functions/not-found": "Code d'invitation invalide ou expiré.",
    "functions/unauthenticated": "Connexion requise.",
    "functions/unavailable": "Connexion impossible. Vérifiez votre réseau.",
  };
  // A thrown HttpsError message is server-authored French; prefer it when present.
  const serverMsg = (error as { message?: string })?.message;
  return new Error(messages[code] ?? serverMsg ?? "Une erreur est survenue. Veuillez réessayer.");
}

async function call<T, R>(name: string, data: T): Promise<R> {
  try {
    const fn = httpsCallable<T, R>(functions, name);
    return (await fn(data)).data;
  } catch (error) {
    throw frenchError(error);
  }
}

export interface RegisterCompanyPayload {
  method: "password" | "google";
  siret: string; companyName: string; nom: string; prenom: string;
  telephone: string; departement: string; ville: string;
  email?: string; password?: string;
}
export interface AcceptInvitePayload {
  method: "password" | "google";
  code: string; nom: string; prenom: string; telephone: string;
  departement: string; ville: string; password?: string;
}

export const callRegisterCompany = (p: RegisterCompanyPayload) =>
  call<RegisterCompanyPayload, { ok: true }>("registerCompany", p).then(() => undefined);
export const callSendInvite = (email: string) =>
  call<{ email: string }, { ok: true }>("sendInvite", { email }).then(() => undefined);
export const callResolveInvite = (code: string) =>
  call<{ code: string }, { email: string; companyName: string }>("resolveInvite", { code });
export const callAcceptInvite = (p: AcceptInvitePayload) =>
  call<AcceptInvitePayload, { ok: true }>("acceptInvite", p).then(() => undefined);
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (No unit test: this is a thin Firebase binding, exercised in the walkthrough.)

- [ ] **Step 4: Commit**

```bash
git add firebase.core.ts src/lib/data/registration.ts
git commit -m "feat(data): client callables for registration + French error mapping"
```

---

## Task 6: App — Google sign-in wiring (platform split)

**Files:**
- Create: `src/lib/auth/googleSignIn.ts` (native), `src/lib/auth/googleSignIn.web.ts` (web)
- Modify: `src/components/ui/ThirdPartyAuthButtons.tsx`

**Interfaces:**
- Produces:
  - `signInWithGoogle(): Promise<{ prenom: string | null; nom: string | null; email: string | null }>` — signs the user into Firebase Auth via Google and returns profile fields for prefill.

- [ ] **Step 1: Native Google sign-in**

Create `src/lib/auth/googleSignIn.ts`:
```ts
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../../firebaseConfig";

// webClientId comes from the Firebase console (owner setup); read from env so it
// is not hardcoded. iosClientId is only needed on iOS.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export async function signInWithGoogle(): Promise<{
  prenom: string | null; nom: string | null; email: string | null;
}> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new Error("Connexion Google annulée.");
  const { idToken, user } = response.data;
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return { prenom: user.givenName ?? null, nom: user.familyName ?? null, email: user.email ?? null };
}
```

- [ ] **Step 2: Web Google sign-in**

Create `src/lib/auth/googleSignIn.web.ts`:
```ts
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../../../firebaseConfig";

export async function signInWithGoogle(): Promise<{
  prenom: string | null; nom: string | null; email: string | null;
}> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  // Web only gives a single displayName; split best-effort into prénom / nom.
  const parts = (result.user.displayName ?? "").trim().split(/\s+/);
  return {
    prenom: parts[0] || null,
    nom: parts.length > 1 ? parts.slice(1).join(" ") : null,
    email: result.user.email ?? null,
  };
}
```

- [ ] **Step 3: Enable Google, disable Apple/Facebook in the buttons**

Replace the provider map + button rendering in `src/components/ui/ThirdPartyAuthButtons.tsx` so only Google is active; Apple/Facebook render disabled with "bientôt disponible":
```tsx
const PROVIDERS: { id: "google" | "apple" | "facebook"; label: string; enabled: boolean }[] = [
  { id: "google", label: "Google", enabled: true },
  { id: "apple", label: "Apple — bientôt disponible", enabled: false },
  { id: "facebook", label: "Facebook — bientôt disponible", enabled: false },
];
```
And in the render, map `PROVIDERS`, passing `disabled={!p.enabled}` to the `TouchableOpacity`, `onPress={() => p.enabled && onPress(p.id)}`, and a muted style when disabled (`opacity: 0.5`). Keep the prop type `onPress: (provider: "google" | "apple" | "facebook") => void`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean. (Google sign-in is native/OAuth — verified on-device in the walkthrough.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/googleSignIn.ts src/lib/auth/googleSignIn.web.ts src/components/ui/ThirdPartyAuthButtons.tsx
git commit -m "feat(auth): Google sign-in wiring (native + web); disable Apple/Facebook"
```

---

## Task 7: App — `AuthProvider.refreshSession()`

The Google registration path sets claims *after* sign-in, and `onAuthStateChanged`
does not re-fire on claim changes. Expose a manual re-read.

**Files:**
- Modify: `src/lib/auth/AuthProvider.tsx`, `src/lib/data/useSession.ts`

**Interfaces:**
- Produces: `refreshSession(): Promise<void>` on the auth context + `useSession()` return.

- [ ] **Step 1: Extract the load + expose refresh**

In `AuthProvider.tsx`, the `onAuthStateChanged` callback already: force-refreshes the token (`getIdTokenResult(true)`), parses claims, loads the profile, and calls `setSession(...)`. Extract that body into a `loadSession(user)` function reachable outside the listener, and expose:
```ts
  const refreshSession = useCallback(async () => {
    if (auth.currentUser) await loadSession(auth.currentUser);
  }, []);
```
Add `refreshSession` to the context value and its type (`refreshSession: () => Promise<void>`). `loadSession` must call `user.getIdToken(true)` (force refresh) before `getIdTokenResult()` so freshly-set claims are pulled.

- [ ] **Step 2: Surface it on `useSession`**

In `src/lib/data/useSession.ts`, add `refreshSession` to the returned object:
```ts
  const { session, status, loading, signOut, refreshSession } = useAuth();
  return { user: session, role: session?.role ?? null, status, loading, signOut, refreshSession };
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/AuthProvider.tsx src/lib/data/useSession.ts
git commit -m "feat(auth): expose refreshSession for the post-registration claim refresh"
```

---

## Task 8: App — company registration wiring

**Files:**
- Modify: `src/features/b2b-registration/submit.ts`, `src/app/(auth)/register.tsx`

**Interfaces:**
- Consumes: `callRegisterCompany` (Task 5), `signInWithGoogle` (Task 6), `refreshSession`/`useSession` (Task 7), `signInWithEmailAndPassword`.

- [ ] **Step 1: Real `submitCompanyRegistration`**

Replace `src/features/b2b-registration/submit.ts`:
```ts
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import { callRegisterCompany } from "@/lib/data/registration";
import type { B2bCompanyRegistrationForm } from "./schema";

/**
 * Email/password: the function creates the account (pending) atomically, then we
 * sign in so `onAuthStateChanged` picks up the new claims and the guard shows the
 * pending gate. (The Google path is handled at the call site — the user is already
 * signed in, so it calls `callRegisterCompany({method:"google", …})` then
 * `refreshSession()`.)
 */
export async function submitCompanyRegistration(values: B2bCompanyRegistrationForm): Promise<void> {
  await callRegisterCompany({ method: "password", ...values });
  await signInWithEmailAndPassword(auth, values.email, values.password);
}
```

- [ ] **Step 2: Wire Google on the register screen**

In `src/app/(auth)/register.tsx`: import `useSession`, `signInWithGoogle`, `callRegisterCompany`. Add `const { refreshSession } = useSession();`. Render `ThirdPartyAuthButtons` on the account step (per the spec) with an `onPress` that, for `"google"`:
1. `const profile = await signInWithGoogle();`
2. prefill the coordonnées step fields from `profile` (set the form's `prenom`/`nom` values via the step-form's setter; email is the Google email),
3. on final submit call `callRegisterCompany({ method: "google", ...values })` then `await refreshSession()`.

Keep the existing email/password submit calling `submitCompanyRegistration(values)`. Surface any thrown `err.message` via the existing `Alert`. The guard routes to the pending gate on success (claims `status: "pending"`).

> If `register.tsx` uses the shared `useStepForm`, prefill by calling its `form.setValue("prenom", profile.prenom ?? "")` etc. after Google sign-in, and advance to the coordonnées step.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/b2b-registration/submit.ts "src/app/(auth)/register.tsx"
git commit -m "feat(auth): real company registration (email/password + Google)"
```

---

## Task 9: App — invite a colleague

**Files:**
- Modify: `src/lib/data/useInvite.ts`

**Interfaces:**
- Consumes: `callSendInvite` (Task 5).

- [ ] **Step 1: Real `useInvite`**

Replace `src/lib/data/useInvite.ts`:
```ts
import { useCallback } from "react";
import { callSendInvite } from "./registration";

/** Invite a colleague by email: the function issues a one-time 1h code and emails it. */
export function useInvite() {
  const invite = useCallback((email: string) => callSendInvite(email), []);
  return { invite };
}
```

- [ ] **Step 2: Typecheck + lint + test**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: clean; jest unchanged (no unit test — thin binding, walkthrough-verified).

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/useInvite.ts
git commit -m "feat(b2b): real colleague invite via sendInvite callable"
```

---

## Task 10: App — invited registration + invite-code entry

**Files:**
- Create: `src/app/(auth)/invite-code.tsx` (the typed-code entry screen)
- Modify: `src/features/b2b-invited-registration/submit.ts`, `src/app/(auth)/register-invited.tsx`

**Interfaces:**
- Consumes: `callResolveInvite`, `callAcceptInvite` (Task 5), `signInWithGoogle` (Task 6), `refreshSession` (Task 7).

- [ ] **Step 1: Real `submitInvitedRegistration`**

Replace `src/features/b2b-invited-registration/submit.ts`:
```ts
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import { callAcceptInvite } from "@/lib/data/registration";
import type { B2bInvitedRegistrationForm } from "./schema";

/**
 * Email/password invited registration: the function validates the code and creates
 * the (active) account, then we sign in so the guard lands on the dashboard. The
 * code + email arrive via route params from the invite-code entry screen. Google
 * is handled at the call site (already signed in -> callAcceptInvite + refreshSession).
 */
export async function submitInvitedRegistration(
  values: B2bInvitedRegistrationForm & { code: string },
): Promise<void> {
  await callAcceptInvite({ method: "password", code: values.code, nom: values.nom, prenom: values.prenom, telephone: values.telephone, departement: values.departement, ville: values.ville, password: values.password });
  await signInWithEmailAndPassword(auth, values.email, values.password);
}
```

- [ ] **Step 2: Invite-code entry screen**

Create `src/app/(auth)/invite-code.tsx` — a single-field screen (label "Code d'invitation", 6-char uppercase input) that calls `callResolveInvite(code)` on submit; on success navigates to `register-invited` passing `{ code, email }` as params; on failure shows the thrown French `err.message`. Use the shared `FormLayout`/`ControlledField` conventions and `tokens`; the input transforms to uppercase and caps at 6 chars. Add a link to this screen from the sign-in screen ("J'ai un code d'invitation"). Match the copy in `page-add-colleague.md`/`form-b2b-invited-registration.md`.

- [ ] **Step 3: Wire `register-invited.tsx`**

In `src/app/(auth)/register-invited.tsx`: read `code` + `email` from route params (`useLocalSearchParams`); prefill the email field **disabled** with `email`; on email/password submit call `submitInvitedRegistration({ ...values, code })`; wire the Google button to `signInWithGoogle()` (prefill prénom/nom) then `callAcceptInvite({ method: "google", code, ...values })` + `refreshSession()`. On success the guard routes to the dashboard (claims `status: "active"`). Surface thrown `err.message` via `Alert`.

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(auth)/invite-code.tsx" src/features/b2b-invited-registration/submit.ts "src/app/(auth)/register-invited.tsx"
git commit -m "feat(auth): invited registration with typed invite-code entry (email/password + Google)"
```

---

## Task 11: Rules + schema trim + TTL doc + spec sync

**Files:**
- Modify: `firestore.rules`, `src/lib/firestore/schema.ts`, `docs/specs/form-b2b-invited-registration.md`, `docs/specs/form-b2b-company-registration.md`, `docs/tech/test-auth.md`
- Test: `src/lib/firestore/__tests__/rules.test.ts`

- [ ] **Step 1: Failing rules tests — invitations closed, companies server-only**

Add to `src/lib/firestore/__tests__/rules.test.ts` (reuse the file's existing `db`/context helpers and `assertFails`):
```ts
test("clients cannot read or write invitations", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(getDoc(doc(db, "invitations/inv_1")));
  await assertFails(setDoc(doc(db, "invitations/inv_2"), { email: "x@x.fr" }));
});

test("clients cannot create a company", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertFails(setDoc(doc(db, "companies/comp_x"), { siret: "12345678901234", name: "X", status: "pending" }));
});
```

- [ ] **Step 2: Run — fails**

Run (emulators must be free): `JAVA_HOME=/usr/local/jdk-26.0.1 PATH=/usr/local/jdk-26.0.1/bin:$PATH npx -y firebase-tools@latest emulators:exec --only firestore,storage --project bike-eco-43a84 "npx jest --config jest.rules.config.js -t 'invitations|create a company'"`
Expected: FAIL if the current rules allow these (or PASS already if default-deny — in which case confirm the tests are meaningful by checking the rules explicitly deny; adjust the rules in Step 3 to make the deny explicit and documented).

- [ ] **Step 3: Rules — explicit locks**

In `firestore.rules`, ensure `match /invitations/{id}` is fully closed (`allow read, write: if false;`) and `match /companies/{id}` has **no** client `create` (reads per existing membership rule; `create`/`write` denied for clients — only the Admin SDK writes). Keep existing `users`/`dossiers` rules unchanged.

- [ ] **Step 4: Run — passes**

Run the same command as Step 2.
Expected: PASS; and the full suite still green.

- [ ] **Step 5: Trim the invitation status enum**

In `src/lib/firestore/schema.ts` change:
```ts
export const INVITATION_STATUSES = ["pending"] as const;
```
(An invitation is only ever `pending` while it exists — acceptance/expiry delete it.) Fix any resulting type usages.

- [ ] **Step 6: Document the TTL policy + spec sync**

- In `docs/tech/test-auth.md`, add a note that the live project needs a Firestore **TTL policy** on `invitations.expiresAt` (console or `gcloud firestore fields ttls update expiresAt --collection-group=invitations --enable-ttl --database=bike-eco-db`).
- In `docs/specs/form-b2b-company-registration.md` and `form-b2b-invited-registration.md`, note the Google-profile prefill of the coordonnées step, and (invited) the preceding typed invite-code entry screen.

- [ ] **Step 7: Typecheck, lint, jest**

Run: `npx tsc --noEmit && npm run lint && npx jest`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add firestore.rules src/lib/firestore/schema.ts src/lib/firestore/__tests__/rules.test.ts docs/tech/test-auth.md docs/specs/form-b2b-invited-registration.md docs/specs/form-b2b-company-registration.md
git commit -m "feat(security): lock invitations + company creation server-side; trim invite status; TTL doc"
```

---

## Task 12: Seed — active company for invite testing

**Files:**
- Modify: `scripts/seed.ts`

The invite flow needs an active b2b user to send from — `user_b2b` (comp_nord)
already exists and is active in the seed, so `sendInvite` is testable as-is. Add
nothing new unless a second inviter is wanted. This task is a **no-op checkpoint**:
confirm the seed already provides an active b2b user; if it does, skip to Task 13.

- [ ] **Step 1: Confirm** `scripts/seed.ts` seeds `user_b2b` with `status: active`, `role: b2b`, `companyId: comp_nord`. It does. No change required.

---

## Task 13: Interactive walkthrough (needs Google native config + a device)

**Files:** none (verification gate).

Prerequisite owner setup (cannot be automated): Google provider enabled in the
console; `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (+ iOS id) set; `google-services.json`
/ `GoogleService-Info.plist` + the google-signin config plugin in `app.json`;
**dev-client rebuild** (`npx expo prebuild --clean && npx expo run:android`). SMTP
secrets reused. Live: a Firestore TTL policy on `invitations.expiresAt`.

- [ ] **Step 1: Emulators + seed + app**

```sh
JAVA_HOME=/usr/local/jdk-26.0.1 PATH=/usr/local/jdk-26.0.1/bin:$PATH npx -y firebase-tools@latest emulators:start --only auth,firestore,storage,functions --project bike-eco-43a84
npm run seed
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start
```

- [ ] **Step 2: Company registration (email/password)** — complete the funnel; expect the confirmation, then the **pending gate**. In the Emulator UI (`http://localhost:4000/firestore/bike-eco-db/data`): a `companies` doc `status: pending`, a `users` doc `status: pending`, and (Auth emulator) a new user; the applicant email appears in the Functions emulator logs (DEV_EMAIL_OVERRIDE).

- [ ] **Step 3: Company registration (Google)** — tap Google, sign in; prénom/nom/email prefill the coordonnées step; finish; same pending-gate result, `users` doc keyed by the Google uid.

- [ ] **Step 4: Duplicate SIRET** — register again with the same SIRET → the French "déjà enregistrée" error.

- [ ] **Step 5: Invite** — as `b2b@garage-nord.fr` (active), Settings → invite a colleague → enter an email → confirmation. In the emulator: an `invitations` doc with a `tokenHash` and `expiresAt` ~1h out; the 6-char code in the Functions logs.

- [ ] **Step 6: Invited registration** — from the sign-in screen, "J'ai un code d'invitation" → enter the code → email prefills (disabled) → finish → lands on the **dashboard** (active). The `invitations` doc is **deleted**; a `users` doc `status: active`, `companyId: comp_nord`.

- [ ] **Step 7: Bad/expired code** — a wrong code → "invalide ou expiré"; a reused code (after Step 6) → same.

- [ ] **Step 8: Full green sweep**

```sh
npx tsc --noEmit && npm run lint && npx jest
cd functions && npm run build && npm run lint && npm test && cd ..
```
Expected: all clean.

---

## Self-review notes (author)

- **Spec coverage:** registerCompany/sendInvite/resolveInvite/acceptInvite → Tasks 3–4; hybrid auth (A) → core.ts branches + email/pw sign-in-after vs Google refresh (Tasks 8/10); 6-char/1h/hash code → Task 1 + core; delete-on-accept/expiry + TTL → core + Task 11; Google wiring + profile prefill → Tasks 6/8/10; SIRET-unique → core; applicant-only email → emails.ts (no team email); invitations closed + companies server-only → Task 11; schema trim → Task 11; named DB → Task 4 `getFirestore(app,"bike-eco-db")`; owner setup + walkthrough → Task 13.
- **Testability:** all business logic is in `core.ts`/`inviteCode.ts`/`schemas.ts` unit-tested with fakes; wrappers, client bindings, Google, and screens are thin and verified in the walkthrough — no mock-only tests.
- **Deliberate:** `sendInviteCore` reuses `deps.newCompanyId()` as a generic random-id source (Firestore `.doc().id`) rather than adding a near-duplicate dep — noted so a reviewer doesn't read it as a copy-paste error.
- **Open flag for the implementer:** confirm the functions' deploy **region** matches the client `getFunctions(app, region)` (Task 5 Step 1) — either set `region: "europe-west9"` in the `onCall` options or use the default `us-central1` consistently on both sides. The emulator ignores region.
