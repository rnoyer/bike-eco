# User Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every account an `isAdmin` flag, let an admin list / promote / delete the users of their own company (or of the back-office team), let a non-admin delete their own account, and rebuild the back-office "Entreprise" page around the new colleague card.

**Architecture:** `isAdmin` is a server-set field on `users/{uid}` (no custom claim — server callables read the caller's document, which is always fresh). Three new callables in `functions/src/users/` follow the existing `registration/` shape: a pure `core.ts` with injected deps (unit tested), a Zod `schemas.ts`, a thin `index.ts`. The client gets two live hooks and three callable wrappers, then screens shared by the `(b2b)` and `(backoffice)` route groups.

**Tech Stack:** Expo SDK 56 + Expo Router (typed routes), React Native, `@expo/ui` for info lists, Firebase JS SDK v12 (client), firebase-admin + firebase-functions v2 (server), Zod v4, Jest (`jest-expo` for the app, plain jest in `functions/`), `@firebase/rules-unit-testing` for the rules.

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-08-05-user-management-design.md`. Read it before starting.
- All user-facing copy is **French**, verbatim as written in this plan.
- Names are rendered **"[Nom] [Prénom]"** (nom first) everywhere in this feature.
- `role`, `companyId`, `status` and now `isAdmin` are **server-set only** — never written by a client.
- Deleting a user never deletes dossiers, chat messages or Storage files.
- App gate (run from the repo root): `npx tsc --noEmit && npx expo lint && npm test`.
- Functions gate (run from `functions/`): `npm run build && npm test && npm run lint`.
- Rules gate (repo root): `npm run test:rules`; if the emulator fails to start, prefix with `JAVA_HOME=/usr/local/jdk-26.0.1`.
- After adding a route file under `src/app/`, `tsc` cannot resolve its `href` until `.expo/types/router.d.ts` is regenerated — bare `tsc` does not do it. Run `npx expo start --clear` briefly (or `npx expo customize tsconfig.json`-free equivalent: start the dev server once) so the types are written, then re-run `tsc`. See `docs/tech/verification.md`.
- Import jest globals explicitly in every test file: `import { describe, expect, test } from "@jest/globals";`
- House testing style: pure logic is unit tested; screens and components are gated by `tsc` + lint only. Do not add render tests.
- Commit after every task, message in the repo's style (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`). End each commit message with:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

**Created**

| File | Responsibility |
|---|---|
| `functions/src/errors.ts` | `RegError` / `RegErrorCode` / `CallerClaims`, shared by every callable module |
| `functions/src/users/schemas.ts` | Zod payloads for the three user callables |
| `functions/src/users/core.ts` | Pure authorization + mutation logic with injected deps |
| `functions/src/users/core.test.ts` | Unit tests for the above |
| `functions/src/users/schemas.test.ts` | Payload validation tests |
| `functions/src/users/index.ts` | Real deps + `onCall` wiring |
| `src/lib/data/colleagues.ts` | Pure helpers: `roleLabel`, `sortByName`, `colleagueQueryKey` |
| `src/lib/data/__tests__/colleagues.test.ts` | Tests for the above |
| `src/lib/data/useColleagues.ts` | Live colleague list for the signed-in user's scope |
| `src/lib/data/useUser.ts` | Live single `users/{uid}` document |
| `src/lib/data/users.ts` | Callable wrappers |
| `src/components/ui/EntityCard.tsx` | The shared card visual (title, subtitle, optional right button) |
| `src/components/ui/ColleagueCard.tsx` | `EntityCard` bound to an `AppUser` |
| `src/components/ui/ConfirmModal.tsx` | The shared destructive-confirmation modal |
| `src/components/screens/ColleaguesScreen.tsx` | "Mes collaborateurs" list, shared by both groups |
| `src/components/screens/ColleagueScreen.tsx` | Colleague detail, manage + read-only modes |
| `src/app/(b2b)/colleagues/index.tsx` | b2b route → `ColleaguesScreen` |
| `src/app/(b2b)/colleagues/[uid].tsx` | b2b route → `ColleagueScreen` (manage) |
| `src/app/(backoffice)/colleagues/index.tsx` | back-office route → `ColleaguesScreen` |
| `src/app/(backoffice)/colleagues/[uid].tsx` | back-office route → `ColleagueScreen` (manage) |
| `src/app/(backoffice)/users/[uid].tsx` | back-office route → `ColleagueScreen` (read-only) |
| `docs/specs/page-colleagues.md`, `docs/specs/page-colleague.md`, `docs/specs/component-card-colleague.md` | New specs |

**Modified**

`src/lib/firestore/schema.ts` · `src/lib/auth/session.test.ts` · `functions/src/registration/core.ts` · `functions/src/registration/core.test.ts` · `functions/src/registration/backoffice.ts` · `functions/src/registration/backoffice.test.ts` · `functions/src/messages/core.ts` · `functions/src/messages/core.test.ts` · `functions/src/callable.ts` · `functions/src/index.ts` · `scripts/grant-b2b.js` · `scripts/grant-backoffice.js` · `scripts/seed.ts` · `firestore.rules` · `src/lib/firestore/__tests__/rules.test.ts` · `src/components/ui/CompanyCard.tsx` · `src/components/native/AccountInfoList.tsx` · `src/components/form/SettingsList.tsx` · `src/components/screens/SettingsScreen.tsx` · `src/components/screens/AccountScreen.tsx` · `src/app/(b2b)/(tabs)/settings.tsx` · `src/app/(backoffice)/(tabs)/settings.tsx` · `src/app/(b2b)/_layout.tsx` · `src/app/(backoffice)/_layout.tsx` · `src/app/(backoffice)/companies/[id].tsx` · docs listed in Task 12

**Left alone**: `assets/images/icons/phone.svg` (committed in `6b6ff43`). The final design
dropped the phone/email icon buttons, so nothing imports it — leave the asset in place
rather than deleting a file the repo owner just added.

---

### Task 1: `isAdmin` on the data model and every account-creation path

**Files:**
- Modify: `src/lib/firestore/schema.ts:76-86`
- Modify: `src/lib/auth/session.test.ts:6-11`
- Modify: `functions/src/registration/core.ts:52-59`, `:92`, `:148`
- Modify: `functions/src/registration/core.test.ts`
- Modify: `scripts/grant-backoffice.js`, `scripts/grant-b2b.js`, `scripts/seed.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AppUser.isAdmin: boolean`; `profileDoc(input, email, companyId, status, isAdmin)` in `functions/src/registration/core.ts`.

- [ ] **Step 1: Write the failing functions tests**

In `functions/src/registration/core.test.ts`, add at the end of the file (it already
defines `fakeDeps` and `companyInput`, and its `createUser` fake returns `"uid_new"`):

```ts
test("registerCompany makes the registrant an admin", async () => {
  const d = fakeDeps();
  await registerCompanyCore(companyInput, null, null, d);
  expect(d.calls.users["uid_new"].isAdmin).toBe(true);
});

test("acceptInvite creates a non-admin colleague", async () => {
  const inv = {
    id: "inv1", email: "new@x.fr", companyId: "comp_1", companyName: "G",
    tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore(
    { method: "password", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000", password: "password123" },
    null, null, d,
  );
  expect(d.calls.users["uid_new"].isAdmin).toBe(false);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd functions && npx jest src/registration/core.test.ts`
Expected: FAIL — `expect(received).toBe(expected)` with `received: undefined`.

- [ ] **Step 3: Add the field to the schema**

In `src/lib/firestore/schema.ts`, inside `interface AppUser`, after `companyId`:

```ts
  /**
   * Server-set. `true` for the user who registered the company and for
   * back-office accounts, `false` for an invited colleague. Admins manage
   * their team (promote / delete) and cannot be deleted.
   */
  isAdmin: boolean;
```

- [ ] **Step 4: Write it on both registration paths**

In `functions/src/registration/core.ts`, change `profileDoc` and its two call sites:

```ts
function profileDoc(
  input: { nom: string; prenom: string; telephone: string },
  email: string,
  companyId: string,
  status: "pending" | "active",
  isAdmin: boolean,
) {
  return {
    role: "b2b", companyId, isAdmin,
    nom: input.nom, prenom: input.prenom, email,
    telephone: input.telephone,
    status,
  };
}
```

Line 92 (`registerCompanyCore`) becomes:

```ts
  await deps.writeUser(uid, profileDoc(input, email, companyId, "pending", true));
```

Line 148 (`acceptInviteCore`) becomes:

```ts
  await deps.writeUser(uid, profileDoc(input, inv.email, inv.companyId, "active", false));
```

- [ ] **Step 5: Run the functions tests**

Run: `cd functions && npm run build && npm test`
Expected: PASS.

- [ ] **Step 6: Fix the app-side type break**

`AppUser` gained a required field, so `src/lib/auth/session.test.ts`'s fixture no longer type-checks. Add `isAdmin: false` to the `profile` object:

```ts
const profile: AppUser = {
  role: "b2b", companyId: "comp_1", isAdmin: false,
  nom: "Durand", prenom: "Camille", email: "c@x.fr",
  telephone: "0600000000",
  status: "active", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
};
```

- [ ] **Step 7: Update the ops scripts**

`scripts/grant-backoffice.js` — back-office accounts are admins by default, with an opt-out. In `parseArgs`, flags are read as `--flag value` pairs, so add a boolean-style flag by checking presence. Add above `main()`:

```js
// Back-office accounts are admins by default: they are the founding team, and
// an admin is the only account that can manage (or delete) team members.
// `--no-admin true` creates a plain member.
function readIsAdmin(args) {
  return args["no-admin"] === undefined;
}
```

In `main()`, after `const args = parseArgs(...)`:

```js
  const isAdmin = readIsAdmin(args);
```

Add `isAdmin,` to the `ref.set({ ... })` profile object (next to `companyId: null,`), and extend the usage string in `parseArgs` with ` [--no-admin true]`. Also append to the final `console.log`: `` `Admin: ${isAdmin}.\n` ``.

`scripts/grant-b2b.js` — the account is an admin when this run created the company, or when `--admin` is passed. `resolveCompany` already knows which branch it took; make it report that. Change its two `return` statements to return an object:

```js
    return { id: snap.id, created: false };   // existing company by --company
```
```js
    return { id: doc.id, created: false };    // existing company found by SIRET
```
```js
  return { id, created: true };               // company created by this run
```

In `main()`:

```js
  const { id: companyId, created } = await resolveCompany(db, args, user.uid);
  // The company's creator is its admin — same rule as the registration funnel.
  const isAdmin = created || args.admin !== undefined;
```

Add `isAdmin,` to the `ref.set({ ... })` profile object, extend `USAGE` with ` [--admin true]`, and mention the flag in the file's header comment.

`scripts/seed.ts` — add `isAdmin` to each seeded user document: `true` for `user_bo` and for the company owners (`user_b2b_nord`, `user_b2b_sud`, `user_pending_owner`), `false` for `user_pending`. Match each `db.doc('users/…').set({ … })` call; add the field next to `companyId`.

- [ ] **Step 8: Run the app gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/firestore/schema.ts src/lib/auth/session.test.ts functions/src/registration scripts/
git commit -m "feat: add isAdmin to the user model and every account-creation path

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Shared `functions/src/errors.ts`

Pure refactor, no behaviour change: `RegError` and `CallerClaims` currently live in `registration/core.ts`, and the new `users/` module must not depend on the registration module.

**Files:**
- Create: `functions/src/errors.ts`
- Modify: `functions/src/registration/core.ts:10-25`, `functions/src/registration/backoffice.ts:1`, `functions/src/registration/backoffice.test.ts:2`, `functions/src/messages/core.ts:1`, `functions/src/messages/core.test.ts:7`, `functions/src/callable.ts:7`

**Interfaces:**
- Consumes: nothing.
- Produces: `functions/src/errors.ts` exporting `RegError`, `type RegErrorCode`, `type CallerClaims` — identical shapes to today's.

- [ ] **Step 1: Create the module**

```ts
// functions/src/errors.ts
/** Error codes that map 1:1 onto Firebase `HttpsError` codes (see `toHttps`). */
export type RegErrorCode =
  | "unauthenticated" | "permission-denied" | "already-exists"
  | "invalid-argument" | "not-found" | "failed-precondition";

/** A failure with French, user-facing copy. `toHttps` turns it into an HttpsError. */
export class RegError extends Error {
  constructor(public code: RegErrorCode, message: string) {
    super(message);
  }
}

/** The caller's identity, read from the verified ID token's custom claims. */
export interface CallerClaims {
  uid: string;
  role?: string;
  status?: string;
  companyId?: string | null;
}
```

- [ ] **Step 2: Point every consumer at it**

In `functions/src/registration/core.ts`, delete the `RegErrorCode` type, the `RegError` class and the `CallerClaims` interface (lines 10-25) and replace them with:

```ts
import { RegError, type CallerClaims } from "../errors";
```

Keep the file's other imports. `RegError` and `CallerClaims` are used further down the file, so the import is enough.

Then change these imports:

- `functions/src/registration/backoffice.ts:1` → `import { RegError, type CallerClaims } from "../errors";`
- `functions/src/registration/backoffice.test.ts:2` → `import type { CallerClaims } from "../errors";`
- `functions/src/messages/core.ts:1` → `import { RegError, type CallerClaims } from "../errors";`
- `functions/src/messages/core.test.ts:7` → `import type { CallerClaims } from "../errors";`
- `functions/src/callable.ts:7` → `import { RegError, type CallerClaims } from "./errors";`

- [ ] **Step 3: Verify nothing still imports them from the old place**

Run: `cd functions && grep -rn "RegError\|CallerClaims" src | grep "registration/core"`
Expected: no output.

- [ ] **Step 4: Run the functions gate**

Run: `cd functions && npm run build && npm test && npm run lint`
Expected: all green, same test count as before.

- [ ] **Step 5: Commit**

```bash
git add functions/src
git commit -m "refactor: hoist RegError and CallerClaims into functions/src/errors.ts

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `functions/src/users/` — schemas and pure core

**Files:**
- Create: `functions/src/users/schemas.ts`, `functions/src/users/schemas.test.ts`, `functions/src/users/core.ts`, `functions/src/users/core.test.ts`

**Interfaces:**
- Consumes: `RegError`, `CallerClaims` from `functions/src/errors.ts` (Task 2).
- Produces:
  - `colleagueAdminSchema`, `colleagueActionSchema`, `type ColleagueAdminInput`, `type ColleagueActionInput`
  - `type Scope = { kind: "company"; companyId: string } | { kind: "backoffice" }`
  - `interface TargetUser { uid, role, companyId, isAdmin, nom, prenom }`
  - `interface UsersDeps { getUser, countAdmins, setAdmin, deleteAuthUser, deleteUserDoc }`
  - `setColleagueAdminCore(input, caller, deps)`, `deleteColleagueCore(input, caller, deps)`, `deleteMyAccountCore(caller, deps)` — all `Promise<void>`

- [ ] **Step 1: Write the schemas**

```ts
// functions/src/users/schemas.ts
import { z } from "zod";

export const colleagueAdminSchema = z.object({
  uid: z.string().trim().min(1),
  isAdmin: z.boolean(),
});
export const colleagueActionSchema = z.object({
  uid: z.string().trim().min(1),
});

export type ColleagueAdminInput = z.infer<typeof colleagueAdminSchema>;
export type ColleagueActionInput = z.infer<typeof colleagueActionSchema>;
```

- [ ] **Step 2: Write the schema tests**

```ts
// functions/src/users/schemas.test.ts
import { expect, test } from "@jest/globals";
import { colleagueActionSchema, colleagueAdminSchema } from "./schemas";

test("colleagueAdminSchema accepts a uid and a boolean", () => {
  expect(colleagueAdminSchema.parse({ uid: "u1", isAdmin: true }))
    .toEqual({ uid: "u1", isAdmin: true });
});

test("colleagueAdminSchema rejects a missing uid", () => {
  expect(colleagueAdminSchema.safeParse({ isAdmin: true }).success).toBe(false);
});

test("colleagueAdminSchema rejects a non-boolean isAdmin", () => {
  expect(colleagueAdminSchema.safeParse({ uid: "u1", isAdmin: "yes" }).success).toBe(false);
});

test("colleagueActionSchema rejects a blank uid", () => {
  expect(colleagueActionSchema.safeParse({ uid: "   " }).success).toBe(false);
});
```

- [ ] **Step 3: Run the schema tests**

Run: `cd functions && npx jest src/users/schemas.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing core tests**

```ts
// functions/src/users/core.test.ts
import { expect, test } from "@jest/globals";
import type { CallerClaims } from "../errors";
import {
  deleteColleagueCore, deleteMyAccountCore, setColleagueAdminCore,
  type TargetUser, type UsersDeps,
} from "./core";

const admin: CallerClaims = { uid: "admin1", role: "b2b", status: "active", companyId: "comp_1" };
const member: CallerClaims = { uid: "mem1", role: "b2b", status: "active", companyId: "comp_1" };
const boAdmin: CallerClaims = { uid: "bo1", role: "backoffice", status: "active", companyId: null };

const user = (over: Partial<TargetUser> & { uid: string }): TargetUser => ({
  role: "b2b", companyId: "comp_1", isAdmin: false, nom: "Durand", prenom: "Camille", ...over,
});

const USERS: Record<string, TargetUser> = {
  admin1: user({ uid: "admin1", isAdmin: true }),
  admin2: user({ uid: "admin2", isAdmin: true }),
  mem1: user({ uid: "mem1" }),
  mem2: user({ uid: "mem2" }),
  other: user({ uid: "other", companyId: "comp_2" }),
  bo1: user({ uid: "bo1", role: "backoffice", companyId: null, isAdmin: true }),
  bo2: user({ uid: "bo2", role: "backoffice", companyId: null }),
};

interface Calls { admins: { uid: string; isAdmin: boolean }[]; authDeleted: string[]; docsDeleted: string[] }

function fakeDeps(over: Partial<UsersDeps> = {}): UsersDeps & { calls: Calls } {
  const calls: Calls = { admins: [], authDeleted: [], docsDeleted: [] };
  return {
    calls,
    getUser: async (uid) => USERS[uid] ?? null,
    countAdmins: async () => 2,
    setAdmin: async (uid, isAdmin) => { calls.admins.push({ uid, isAdmin }); },
    deleteAuthUser: async (uid) => { calls.authDeleted.push(uid); },
    deleteUserDoc: async (uid) => { calls.docsDeleted.push(uid); },
    ...over,
  };
}

test("an admin promotes a colleague of their company", async () => {
  const d = fakeDeps();
  await setColleagueAdminCore({ uid: "mem1", isAdmin: true }, admin, d);
  expect(d.calls.admins).toEqual([{ uid: "mem1", isAdmin: true }]);
});

test("a non-admin cannot promote anyone", async () => {
  const d = fakeDeps();
  await expect(setColleagueAdminCore({ uid: "mem2", isAdmin: true }, member, d))
    .rejects.toMatchObject({ code: "permission-denied" });
});

test("an admin cannot touch a user of another company", async () => {
  const d = fakeDeps();
  await expect(setColleagueAdminCore({ uid: "other", isAdmin: true }, admin, d))
    .rejects.toMatchObject({ code: "not-found" });
});

test("a b2b admin cannot touch a back-office user", async () => {
  const d = fakeDeps();
  await expect(setColleagueAdminCore({ uid: "bo2", isAdmin: true }, admin, d))
    .rejects.toMatchObject({ code: "not-found" });
});

test("a back-office admin manages back-office users", async () => {
  const d = fakeDeps();
  await setColleagueAdminCore({ uid: "bo2", isAdmin: true }, boAdmin, d);
  expect(d.calls.admins).toEqual([{ uid: "bo2", isAdmin: true }]);
});

test("demoting the last admin is refused", async () => {
  const d = fakeDeps({ countAdmins: async () => 1 });
  await expect(setColleagueAdminCore({ uid: "admin1", isAdmin: false }, admin, d))
    .rejects.toMatchObject({ code: "failed-precondition" });
  expect(d.calls.admins).toEqual([]);
});

test("setting the flag it already has is a no-op", async () => {
  const d = fakeDeps();
  await setColleagueAdminCore({ uid: "mem1", isAdmin: false }, admin, d);
  expect(d.calls.admins).toEqual([]);
});

test("an admin deletes a colleague: auth user then profile doc, nothing else", async () => {
  const d = fakeDeps();
  await deleteColleagueCore({ uid: "mem1" }, admin, d);
  expect(d.calls.authDeleted).toEqual(["mem1"]);
  expect(d.calls.docsDeleted).toEqual(["mem1"]);
});

test("an admin colleague cannot be deleted", async () => {
  const d = fakeDeps();
  await expect(deleteColleagueCore({ uid: "admin2" }, admin, d))
    .rejects.toMatchObject({
      code: "failed-precondition",
      message: "Un administrateur ne peut pas être supprimé.",
    });
  expect(d.calls.authDeleted).toEqual([]);
});

test("the caller cannot delete themselves from the colleague screen", async () => {
  const d = fakeDeps();
  await expect(deleteColleagueCore({ uid: "admin1" }, admin, d))
    .rejects.toMatchObject({
      code: "failed-precondition",
      message: "Utilisez « Supprimer mon compte » pour votre propre compte.",
    });
  expect(d.calls.authDeleted).toEqual([]);
});

test("a non-admin cannot delete a colleague", async () => {
  const d = fakeDeps();
  await expect(deleteColleagueCore({ uid: "mem2" }, member, d))
    .rejects.toMatchObject({ code: "permission-denied" });
});

test("a non-admin deletes their own account", async () => {
  const d = fakeDeps();
  await deleteMyAccountCore(member, d);
  expect(d.calls.authDeleted).toEqual(["mem1"]);
  expect(d.calls.docsDeleted).toEqual(["mem1"]);
});

test("an admin cannot delete their own account", async () => {
  const d = fakeDeps();
  await expect(deleteMyAccountCore(admin, d))
    .rejects.toMatchObject({ code: "failed-precondition" });
  expect(d.calls.authDeleted).toEqual([]);
});

test("a pending colleague can still delete their own account", async () => {
  const d = fakeDeps();
  await deleteMyAccountCore({ ...member, status: "pending" }, d);
  expect(d.calls.authDeleted).toEqual(["mem1"]);
});

test("an inactive caller cannot manage colleagues", async () => {
  const d = fakeDeps();
  await expect(setColleagueAdminCore({ uid: "mem1", isAdmin: true }, { ...admin, status: "pending" }, d))
    .rejects.toMatchObject({ code: "permission-denied" });
});
```

- [ ] **Step 5: Run the core tests to verify they fail**

Run: `cd functions && npx jest src/users/core.test.ts`
Expected: FAIL — `Cannot find module './core'`.

- [ ] **Step 6: Write the core**

```ts
// functions/src/users/core.ts
import { RegError, type CallerClaims } from "../errors";
import type { ColleagueActionInput, ColleagueAdminInput } from "./schemas";

/** The set of users a caller may act on: their company, or the back-office team. */
export type Scope =
  | { kind: "company"; companyId: string }
  | { kind: "backoffice" };

/** The subset of a `users/{uid}` document these operations need. */
export interface TargetUser {
  uid: string;
  role: string;
  companyId: string | null;
  isAdmin: boolean;
  nom: string;
  prenom: string;
}

export interface UsersDeps {
  getUser(uid: string): Promise<TargetUser | null>;
  /** How many admins the scope currently has. */
  countAdmins(scope: Scope): Promise<number>;
  setAdmin(uid: string, isAdmin: boolean): Promise<void>;
  /** Tolerates an already-missing Auth user. */
  deleteAuthUser(uid: string): Promise<void>;
  deleteUserDoc(uid: string): Promise<void>;
}

/**
 * Scope comes from the verified custom claims (role/companyId), which are the
 * source of truth for access; only `isAdmin` is read from the profile document,
 * because it is deliberately not mirrored into claims (a claim would stay stale
 * until the promoted user's ID token refreshed).
 */
function scopeOf(caller: CallerClaims): Scope {
  if (caller.role === "backoffice") return { kind: "backoffice" };
  if (caller.role === "b2b" && caller.companyId) {
    return { kind: "company", companyId: caller.companyId };
  }
  throw new RegError("permission-denied", "Action non autorisée.");
}

function inScope(target: TargetUser, scope: Scope): boolean {
  return scope.kind === "backoffice"
    ? target.role === "backoffice"
    : target.role === "b2b" && target.companyId === scope.companyId;
}

function lastAdminMessage(scope: Scope): string {
  return scope.kind === "backoffice"
    ? "L'équipe Bike-eco doit garder au moins un administrateur."
    : "Cette entreprise doit garder au moins un administrateur.";
}

async function requireAdminCaller(caller: CallerClaims, deps: UsersDeps): Promise<Scope> {
  if (caller.status !== "active") {
    throw new RegError("permission-denied", "Action réservée aux comptes actifs.");
  }
  const scope = scopeOf(caller);
  const me = await deps.getUser(caller.uid);
  if (!me) throw new RegError("not-found", "Compte introuvable.");
  if (!me.isAdmin) {
    throw new RegError("permission-denied", "Action réservée aux administrateurs.");
  }
  return scope;
}

/** The target must exist *and* be in the caller's scope — the two are reported
 *  identically on purpose, so this never confirms that a uid outside the scope
 *  exists. */
async function requireTarget(uid: string, scope: Scope, deps: UsersDeps): Promise<TargetUser> {
  const target = await deps.getUser(uid);
  if (!target || !inScope(target, scope)) {
    throw new RegError("not-found", "Utilisateur introuvable.");
  }
  return target;
}

export async function setColleagueAdminCore(
  input: ColleagueAdminInput,
  caller: CallerClaims,
  deps: UsersDeps,
): Promise<void> {
  const scope = await requireAdminCaller(caller, deps);
  const target = await requireTarget(input.uid, scope, deps);
  if (target.isAdmin === input.isAdmin) return;
  if (!input.isAdmin && (await deps.countAdmins(scope)) <= 1) {
    throw new RegError("failed-precondition", lastAdminMessage(scope));
  }
  await deps.setAdmin(input.uid, input.isAdmin);
}

export async function deleteColleagueCore(
  input: ColleagueActionInput,
  caller: CallerClaims,
  deps: UsersDeps,
): Promise<void> {
  const scope = await requireAdminCaller(caller, deps);
  if (input.uid === caller.uid) {
    throw new RegError(
      "failed-precondition",
      "Utilisez « Supprimer mon compte » pour votre propre compte.",
    );
  }
  const target = await requireTarget(input.uid, scope, deps);
  if (target.isAdmin) {
    throw new RegError("failed-precondition", "Un administrateur ne peut pas être supprimé.");
  }
  // Auth first: a stranded profile doc is visible and fixable, a stranded Auth
  // user is a signed-in session with no profile. Dossiers, messages and Storage
  // are deliberately untouched — they carry denormalized identity.
  await deps.deleteAuthUser(input.uid);
  await deps.deleteUserDoc(input.uid);
}

/**
 * Self-deletion. Unlike the other two this does not require an `active`
 * account: a colleague still waiting on the company's validation must be able
 * to cancel. Admins are refused — an admin account cannot be deleted.
 */
export async function deleteMyAccountCore(
  caller: CallerClaims,
  deps: UsersDeps,
): Promise<void> {
  const me = await deps.getUser(caller.uid);
  if (!me) throw new RegError("not-found", "Compte introuvable.");
  if (me.isAdmin) {
    throw new RegError(
      "failed-precondition",
      "Un administrateur ne peut pas supprimer son compte.",
    );
  }
  await deps.deleteAuthUser(caller.uid);
  await deps.deleteUserDoc(caller.uid);
}
```

- [ ] **Step 7: Run the core tests**

Run: `cd functions && npx jest src/users`
Expected: PASS (all tests in both files).

- [ ] **Step 8: Run the functions gate**

Run: `cd functions && npm run build && npm test && npm run lint`
Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add functions/src/users
git commit -m "feat: user-management core (promote, delete colleague, delete own account)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Wire the three callables

**Files:**
- Create: `functions/src/users/index.ts`
- Modify: `functions/src/index.ts:9-13`

**Interfaces:**
- Consumes: `setColleagueAdminCore`, `deleteColleagueCore`, `deleteMyAccountCore`, `UsersDeps`, `Scope` (Task 3); `db`, `callerFrom`, `toHttps` from `functions/src/callable.ts`.
- Produces: deployed callables `setColleagueAdmin`, `deleteColleague`, `deleteMyAccount`, each returning `{ ok: true }`.

- [ ] **Step 1: Write the wiring**

```ts
// functions/src/users/index.ts
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/https";

import { callerFrom, db, toHttps } from "../callable";
import {
  deleteColleagueCore, deleteMyAccountCore, setColleagueAdminCore,
  type Scope, type UsersDeps,
} from "./core";
import { colleagueActionSchema, colleagueAdminSchema } from "./schemas";

function usersDeps(): UsersDeps {
  return {
    getUser: async (uid) => {
      const snap = await db().collection("users").doc(uid).get();
      if (!snap.exists) return null;
      const d = snap.data()!;
      return {
        uid: snap.id,
        role: d.role as string,
        companyId: (d.companyId as string | null) ?? null,
        isAdmin: d.isAdmin === true,
        nom: (d.nom as string) ?? "",
        prenom: (d.prenom as string) ?? "",
      };
    },
    // Counted in memory rather than with a two-equality-filter query: teams are
    // small, and this needs no index at all.
    countAdmins: async (scope: Scope) => {
      const q = scope.kind === "backoffice"
        ? db().collection("users").where("role", "==", "backoffice")
        : db().collection("users").where("companyId", "==", scope.companyId);
      const snap = await q.get();
      return snap.docs.filter((doc) => doc.data().isAdmin === true).length;
    },
    setAdmin: async (uid, isAdmin) => {
      await db().collection("users").doc(uid).update({
        isAdmin, updatedAt: FieldValue.serverTimestamp(),
      });
    },
    deleteAuthUser: async (uid) => {
      await getAuth().deleteUser(uid).catch((err: unknown) => {
        // Already gone is the outcome we wanted; anything else is a real failure.
        if ((err as { code?: string })?.code !== "auth/user-not-found") throw err;
      });
    },
    deleteUserDoc: async (uid) => {
      await db().collection("users").doc(uid).delete();
    },
  };
}

export const setColleagueAdmin = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const input = colleagueAdminSchema.parse(req.data);
    await setColleagueAdminCore(input, callerFrom(req), usersDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const deleteColleague = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const input = colleagueActionSchema.parse(req.data);
    await deleteColleagueCore(input, callerFrom(req), usersDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});

export const deleteMyAccount = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    await deleteMyAccountCore(callerFrom(req), usersDeps());
    return { ok: true };
  } catch (e) { toHttps(e); }
});
```

- [ ] **Step 2: Export them**

In `functions/src/index.ts`, after the `registration` export block:

```ts
export { deleteColleague, deleteMyAccount, setColleagueAdmin } from "./users";
```

- [ ] **Step 3: Run the functions gate**

Run: `cd functions && npm run build && npm test && npm run lint`
Expected: all green. The build proves the deps object satisfies `UsersDeps`.

- [ ] **Step 4: Commit**

```bash
git add functions/src
git commit -m "feat: setColleagueAdmin, deleteColleague and deleteMyAccount callables

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Security rules — teammate reads, `isAdmin` locked

**Files:**
- Modify: `firestore.rules:18-26`
- Modify: `src/lib/firestore/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `users/{uid}` readable by a teammate of the same company; `isAdmin` rejected on client writes.

- [ ] **Step 1: Write the failing rules tests**

In `src/lib/firestore/__tests__/rules.test.ts`, inside the `beforeAll` seed block, add two documents:

```ts
    await setDoc(doc(db, "users/user_mate"), {
      nom: "Petit", prenom: "Sam", role: "b2b", companyId: "comp_1", isAdmin: false,
    });
    await setDoc(doc(db, "users/user_other"), {
      nom: "Roux", prenom: "Alix", role: "b2b", companyId: "comp_2", isAdmin: false,
    });
```

Then add three tests next to the existing `users/` ones (around line 97):

```ts
test("a b2b user reads a colleague of the same company", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "users/user_mate")));
});

test("a b2b user cannot read a user of another company", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(getDoc(doc(db, "users/user_other")));
});

test("a user cannot make themselves an admin", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(updateDoc(doc(db, "users/user_b2b_nord"), { isAdmin: true }));
});
```

- [ ] **Step 2: Run the rules tests to verify the first two fail**

Run: `npm run test:rules`
(if the emulator refuses to start: `JAVA_HOME=/usr/local/jdk-26.0.1 npm run test:rules`)
Expected: "reads a colleague of the same company" FAILS (permission denied); the other two pass already.

- [ ] **Step 3: Update the rules**

In `firestore.rules`, replace the `match /users/{uid}` block with:

```
    match /users/{uid} {
      // Owner, back-office, or an active teammate: "Mes collaborateurs" and the
      // company card list read colleagues' profiles, which the owner-only rule
      // used to deny outright.
      allow read: if isSignedIn() && (
        request.auth.uid == uid
        || isBackoffice()
        || (isActive() && resource.data.companyId == myCompany())
      );
      // Owner edits profile fields only; role/companyId/status/isAdmin/createdAt
      // are server-set and must never be client-writable.
      allow update: if request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys()
             .hasAny(['role', 'companyId', 'status', 'isAdmin', 'createdAt']);
      allow create, delete: if false;
    }
```

- [ ] **Step 4: Run the rules tests again**

Run: `npm run test:rules`
Expected: PASS, including the pre-existing cases.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules src/lib/firestore/__tests__/rules.test.ts
git commit -m "feat: let teammates read each other's profile, lock isAdmin from clients

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Client data layer — helpers, hooks, callable wrappers

**Files:**
- Create: `src/lib/data/colleagues.ts`, `src/lib/data/__tests__/colleagues.test.ts`, `src/lib/data/useColleagues.ts`, `src/lib/data/useUser.ts`, `src/lib/data/users.ts`

**Interfaces:**
- Consumes: `usersRef`, `userDoc`, `WithId` from `@/lib/firestore/collections`; `mapDataError`; `useAuth`; `call` from `@/lib/data/callable`.
- Produces:
  - `roleLabel(user: Pick<AppUser, "role" | "isAdmin">): string`
  - `sortByName<T extends { nom: string; prenom: string }>(users: T[]): T[]`
  - `colleagueScope(session: { role: UserRole; companyId: string | null } | null): { kind: "backoffice" } | { kind: "company"; companyId: string } | null`
  - `useColleagues(): { data: WithId<AppUser>[]; loading: boolean; error: string | null }`
  - `useUser(uid: string): { data: WithId<AppUser> | null; loading: boolean; error: string | null }`
  - `callSetColleagueAdmin(uid: string, isAdmin: boolean): Promise<void>`, `callDeleteColleague(uid: string): Promise<void>`, `callDeleteMyAccount(): Promise<void>`

- [ ] **Step 1: Write the failing helper tests**

```ts
// src/lib/data/__tests__/colleagues.test.ts
import { expect, test } from "@jest/globals";
import { colleagueScope, roleLabel, sortByName } from "../colleagues";

test("an admin is labelled Administrateur whatever the role", () => {
  expect(roleLabel({ role: "b2b", isAdmin: true })).toBe("Administrateur");
  expect(roleLabel({ role: "backoffice", isAdmin: true })).toBe("Administrateur");
});

test("a non-admin is Vendeur for b2b and Membre for back-office", () => {
  expect(roleLabel({ role: "b2b", isAdmin: false })).toBe("Vendeur");
  expect(roleLabel({ role: "backoffice", isAdmin: false })).toBe("Membre");
});

test("sortByName orders by nom then prénom, accent-insensitively", () => {
  const sorted = sortByName([
    { nom: "Durand", prenom: "Zoé" },
    { nom: "durand", prenom: "Alex" },
    { nom: "Bernard", prenom: "Sam" },
  ]);
  expect(sorted.map((u) => `${u.nom} ${u.prenom}`)).toEqual([
    "Bernard Sam", "durand Alex", "Durand Zoé",
  ]);
});

test("sortByName does not mutate its input", () => {
  const input = [{ nom: "B", prenom: "x" }, { nom: "A", prenom: "y" }];
  sortByName(input);
  expect(input[0].nom).toBe("B");
});

test("colleagueScope is the company for a b2b user", () => {
  expect(colleagueScope({ role: "b2b", companyId: "comp_1" }))
    .toEqual({ kind: "company", companyId: "comp_1" });
});

test("colleagueScope is the back-office team for a back-office user", () => {
  expect(colleagueScope({ role: "backoffice", companyId: null }))
    .toEqual({ kind: "backoffice" });
});

test("colleagueScope is null without a session or a company", () => {
  expect(colleagueScope(null)).toBeNull();
  expect(colleagueScope({ role: "b2b", companyId: null })).toBeNull();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx jest src/lib/data/__tests__/colleagues.test.ts`
Expected: FAIL — cannot find module `../colleagues`.

- [ ] **Step 3: Write the helpers**

```ts
// src/lib/data/colleagues.ts
import type { AppUser, UserRole } from "@/lib/firestore/schema";

/** Scope of a "Mes collaborateurs" list: one company, or the back-office team. */
export type ColleagueScope =
  | { kind: "company"; companyId: string }
  | { kind: "backoffice" };

/** French label for the card subtitle and the info list's "Rôle" row. */
export function roleLabel(user: Pick<AppUser, "role" | "isAdmin">): string {
  if (user.isAdmin) return "Administrateur";
  return user.role === "backoffice" ? "Membre" : "Vendeur";
}

/** Nom then prénom, using French collation so "Émile" sorts next to "Emile". */
export function sortByName<T extends { nom: string; prenom: string }>(users: T[]): T[] {
  return [...users].sort(
    (a, b) =>
      a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }) ||
      a.prenom.localeCompare(b.prenom, "fr", { sensitivity: "base" }),
  );
}

/** A b2b user's colleagues are their company; a back-office user's are the team. */
export function colleagueScope(
  session: { role: UserRole; companyId: string | null } | null,
): ColleagueScope | null {
  if (!session) return null;
  if (session.role === "backoffice") return { kind: "backoffice" };
  return session.companyId ? { kind: "company", companyId: session.companyId } : null;
}
```

- [ ] **Step 4: Run the helper tests**

Run: `npx jest src/lib/data/__tests__/colleagues.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the hooks**

```ts
// src/lib/data/useColleagues.ts
import { onSnapshot, query, where, type FirestoreError } from "firebase/firestore";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { usersRef, type WithId } from "@/lib/firestore/collections";
import type { AppUser } from "@/lib/firestore/schema";
import { colleagueScope, sortByName } from "./colleagues";
import { mapDataError } from "./dataErrors";

/**
 * Live colleagues of the signed-in user — their company for a b2b account, the
 * back-office team for a back-office one — excluding themselves (you manage
 * your own account on "Mon compte").
 */
export function useColleagues() {
  const { session } = useAuth();
  const scope = colleagueScope(session);
  const uid = session?.id ?? "";
  // A primitive key, so the effect does not re-subscribe on every session
  // object identity change.
  const key = scope ? (scope.kind === "backoffice" ? "backoffice" : scope.companyId) : "";

  const [resolved, setResolved] = useState<{
    key: string;
    data: WithId<AppUser>[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!key || !uid) return;
    const q =
      key === "backoffice"
        ? query(usersRef, where("role", "==", "backoffice"))
        : query(usersRef, where("companyId", "==", key));
    return onSnapshot(
      q,
      (snap) =>
        setResolved({
          key,
          data: sortByName(
            snap.docs.map((d) => ({ ...d.data(), id: d.id })).filter((u) => u.id !== uid),
          ),
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key, data: [], error: mapDataError(err.code) }),
    );
  }, [key, uid]);

  const loading = !key || resolved?.key !== key;
  return {
    data: loading ? [] : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}
```

```ts
// src/lib/data/useUser.ts
import { onSnapshot, type FirestoreError } from "firebase/firestore";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { userDoc, type WithId } from "@/lib/firestore/collections";
import type { AppUser } from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";

/** Live single user profile. Stays loading for an empty uid (route params
 *  resolve late), exactly like `useDossier`. */
export function useUser(uid: string) {
  const { session } = useAuth();
  const [resolved, setResolved] = useState<{
    key: string;
    data: WithId<AppUser> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!session || !uid) return;
    return onSnapshot(
      userDoc(uid),
      (snap) =>
        setResolved({
          key: uid,
          data: snap.exists() ? { ...snap.data(), id: snap.id } : null,
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ key: uid, data: null, error: mapDataError(err.code) }),
    );
  }, [session, uid]);

  const loading = !uid || resolved?.key !== uid;
  return {
    data: loading ? null : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}
```

- [ ] **Step 6: Write the callable wrappers**

```ts
// src/lib/data/users.ts
import { call } from "./callable";

/** Promote or demote a colleague. Server-guarded: admin caller, same scope,
 *  never the last admin. */
export const callSetColleagueAdmin = (uid: string, isAdmin: boolean) =>
  call<{ uid: string; isAdmin: boolean }, { ok: true }>("setColleagueAdmin", { uid, isAdmin })
    .then(() => undefined);

/** Delete a colleague's account. Dossiers, chats and stored files are kept. */
export const callDeleteColleague = (uid: string) =>
  call<{ uid: string }, { ok: true }>("deleteColleague", { uid }).then(() => undefined);

/** Delete the signed-in user's own account. Refused for an admin. */
export const callDeleteMyAccount = () =>
  call<Record<string, never>, { ok: true }>("deleteMyAccount", {}).then(() => undefined);
```

- [ ] **Step 7: Run the app gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data
git commit -m "feat: colleague hooks, helpers and callable wrappers

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Shared UI primitives (`EntityCard`, `ColleagueCard`, `ConfirmModal`, role row)

Extractions with no behaviour change to existing screens; `companies/[id].tsx` is migrated onto `ConfirmModal` here so the extraction is proven by an existing screen.

**Files:**
- Create: `src/components/ui/EntityCard.tsx`, `src/components/ui/ColleagueCard.tsx`, `src/components/ui/ConfirmModal.tsx`
- Modify: `src/components/ui/CompanyCard.tsx`, `src/components/native/AccountInfoList.tsx`, `src/app/(backoffice)/companies/[id].tsx`

**Interfaces:**
- Consumes: `roleLabel` (Task 6), `tokens`, `Button`.
- Produces:
  - `<EntityCard title subtitle actionLabel? onAction? />`
  - `<ColleagueCard user actionLabel? onAction? />` where `user: WithId<AppUser>`
  - `<ConfirmModal visible title message confirmLabel onCancel onConfirm disabled? />`
  - `<AccountInfoList user roleLabel? />`

- [ ] **Step 1: Extract `EntityCard`**

```tsx
// src/components/ui/EntityCard.tsx
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  subtitle: string;
  /** Right-hand button. Omit both to render a card with no action at all. */
  actionLabel?: string;
  onAction?: () => void;
}

/** The thin wide card used by every list of entities (companies, colleagues):
 *  title, subtitle, and an optional right-hand button. */
export default function EntityCard({ title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
      </View>
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.action} onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.md,
    padding: tokens.space.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
  },
  body: { flex: 1, gap: tokens.space.xs },
  title: { fontSize: 15, fontWeight: "600", color: tokens.colors.primary },
  subtitle: { fontSize: 13, color: tokens.colors.muted },
  action: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.primary,
  },
  actionText: { color: tokens.colors.primaryText, fontSize: 14, fontWeight: "600" },
});
```

- [ ] **Step 2: Reduce `CompanyCard` to a wrapper**

Replace the whole of `src/components/ui/CompanyCard.tsx` with:

```tsx
import EntityCard from "@/components/ui/EntityCard";

interface Props {
  title: string;
  subtitle: string;
  onManage: () => void;
}

/** A company in a back-office list. Same visual as every other entity card. */
export default function CompanyCard({ title, subtitle, onManage }: Props) {
  return (
    <EntityCard title={title} subtitle={subtitle} actionLabel="Gérer" onAction={onManage} />
  );
}
```

- [ ] **Step 3: Add `ColleagueCard`**

```tsx
// src/components/ui/ColleagueCard.tsx
import EntityCard from "@/components/ui/EntityCard";
import { roleLabel } from "@/lib/data/colleagues";
import type { WithId } from "@/lib/firestore/collections";
import type { AppUser } from "@/lib/firestore/schema";

interface Props {
  user: WithId<AppUser>;
  /** Omit both to render the card without a button (non-admin viewer). */
  actionLabel?: string;
  onAction?: () => void;
}

/** A colleague in a list: "[Nom] [Prénom]" over "Rôle: […]". */
export default function ColleagueCard({ user, actionLabel, onAction }: Props) {
  return (
    <EntityCard
      title={`${user.nom} ${user.prenom}`}
      subtitle={`Rôle: ${roleLabel(user)}`}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  );
}
```

- [ ] **Step 4: Extract `ConfirmModal`**

Move the modal markup and its four styles out of `src/app/(backoffice)/companies/[id].tsx` into:

```tsx
// src/components/ui/ConfirmModal.tsx
import Button from "@/components/ui/Button";
import { tokens } from "@/theme/tokens";
import { Modal, StyleSheet, Text, View } from "react-native";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  /** Label of the destructive action, e.g. "Supprimer tout". */
  confirmLabel: string;
  /** Locks both buttons while an action is already in flight. */
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Destructive-confirmation modal. An in-page `Modal`, not `confirmDialog`:
 *  these prompts spell out what is deleted, which a native alert cannot. */
export default function ConfirmModal({
  visible, title, message, confirmLabel, disabled = false, onCancel, onConfirm,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>
          <Button label="Annuler" onPress={onCancel} disabled={disabled} />
          <Button
            variant="danger"
            label={confirmLabel}
            onPress={onConfirm}
            disabled={disabled}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "center",
    padding: tokens.space.lg,
  },
  modal: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    padding: tokens.space.lg,
    gap: tokens.space.md,
  },
  title: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
  body: { fontSize: 14, color: tokens.colors.muted },
});
```

- [ ] **Step 5: Use it in the company page**

In `src/app/(backoffice)/companies/[id].tsx`, replace the whole `<Modal>…</Modal>` block with:

```tsx
      <ConfirmModal
        visible={confirmDelete}
        title="Supprimer cette entreprise ?"
        message="Cette action supprime définitivement l'entreprise, ses utilisateurs, tous ses dossiers, les conversations et les documents stockés."
        confirmLabel="Supprimer tout"
        disabled={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void deleting.run();
        }}
      />
```

Add `import ConfirmModal from "@/components/ui/ConfirmModal";`, drop `Modal` from the `react-native` import, and delete the now-unused `backdrop` / `modal` / `modalTitle` / `modalBody` styles.

- [ ] **Step 6: Add the optional role row to `AccountInfoList`**

```tsx
export default function AccountInfoList({
  user,
  roleLabel,
}: {
  user: AppUser;
  /** Adds a "Rôle" row — used by the colleague screens, omitted on "Mon compte". */
  roleLabel?: string;
}) {
  const rows: [string, string][] = [
    ["Nom", user.nom],
    ["Prénom", user.prenom],
    ["Email", user.email],
    ["Téléphone", user.telephone],
    ...(roleLabel ? ([["Rôle", roleLabel]] as [string, string][]) : []),
  ];
```

The rest of the component is unchanged.

- [ ] **Step 7: Run the app gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/components
git commit -m "refactor: extract EntityCard and ConfirmModal, add ColleagueCard

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: "Mes collaborateurs" list + the Paramètres entry point

**Files:**
- Create: `src/components/screens/ColleaguesScreen.tsx`, `src/app/(b2b)/colleagues/index.tsx`, `src/app/(backoffice)/colleagues/index.tsx`
- Modify: `src/components/form/SettingsList.tsx`, `src/components/screens/SettingsScreen.tsx`, `src/app/(b2b)/(tabs)/settings.tsx`, `src/app/(backoffice)/(tabs)/settings.tsx`, `src/app/(b2b)/_layout.tsx`, `src/app/(backoffice)/_layout.tsx`

**Interfaces:**
- Consumes: `useColleagues` (Task 6), `ColleagueCard` (Task 7), `useAccount`.
- Produces: `<ColleaguesScreen onManage={(uid: string) => void} />`; routes `/(b2b)/colleagues` and `/(backoffice)/colleagues`; `SettingsList` prop `onManageColleagues: () => void`.

- [ ] **Step 1: Write the screen**

```tsx
// src/components/screens/ColleaguesScreen.tsx
import ColleagueCard from "@/components/ui/ColleagueCard";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useAccount } from "@/lib/data/useAccount";
import { useColleagues } from "@/lib/data/useColleagues";
import { ScrollView } from "react-native";

interface Props {
  /** Opens the management page. Only ever called for an admin viewer. */
  onManage: (uid: string) => void;
}

/** "Mes collaborateurs": the signed-in user's company (or the back-office team),
 *  minus themselves. Only an admin gets the "Gérer" button. */
export default function ColleaguesScreen({ onManage }: Props) {
  const { data: session } = useAccount();
  const { data, loading, error } = useColleagues();
  const canManage = session?.isAdmin === true;

  return (
    <ScrollView>
      <SectionWrapper>
        <Section
          title="Mes collaborateurs"
          loading={loading}
          error={error}
          emptyMessage="Aucun collaborateur pour le moment."
        >
          {data.map((u) => (
            <ColleagueCard
              key={u.id}
              user={u}
              actionLabel={canManage ? "Gérer" : undefined}
              onAction={canManage ? () => onManage(u.id) : undefined}
            />
          ))}
        </Section>
      </SectionWrapper>
    </ScrollView>
  );
}
```

- [ ] **Step 2: Add both routes**

```tsx
// src/app/(b2b)/colleagues/index.tsx
import ColleaguesScreen from "@/components/screens/ColleaguesScreen";
import { useRouter } from "expo-router";

export default function B2bColleagues() {
  const router = useRouter();
  return <ColleaguesScreen onManage={(uid) => router.push(`/(b2b)/colleagues/${uid}`)} />;
}
```

```tsx
// src/app/(backoffice)/colleagues/index.tsx
import ColleaguesScreen from "@/components/screens/ColleaguesScreen";
import { useRouter } from "expo-router";

export default function BackofficeColleagues() {
  const router = useRouter();
  return (
    <ColleaguesScreen onManage={(uid) => router.push(`/(backoffice)/colleagues/${uid}`)} />
  );
}
```

The `/(b2b)/colleagues/[uid]` and `/(backoffice)/colleagues/[uid]` targets are created in Task 9; `tsc` will not accept these `href`s until then, which Step 7 accounts for.

- [ ] **Step 3: Give both routes a header title**

In `src/app/(b2b)/_layout.tsx`, inside the `<Stack>`:

```tsx
      <Stack.Screen
        name="colleagues/index"
        options={{ title: "Mes collaborateurs" }}
      />
```

Add the identical `<Stack.Screen>` to `src/app/(backoffice)/_layout.tsx`.

- [ ] **Step 4: Add the Paramètres section**

In `src/components/form/SettingsList.tsx`, add `onManageColleagues: () => void;` to `Props`, accept it in the parameter list, and add this section after the existing "Inviter un collègue de mon entreprise" section:

```tsx
      <Section title="Mes collaborateurs">
        <Button
          variant="outlined"
          label="Voir mes collaborateurs"
          onPress={onManageColleagues}
        />
      </Section>
```

- [ ] **Step 5: Thread the prop through**

`src/components/screens/SettingsScreen.tsx` — add `onManageColleagues: () => void;` to `Props`, accept it, and pass it to `<SettingsList>`.

`src/app/(b2b)/(tabs)/settings.tsx`:

```tsx
    <SettingsScreen
      role="b2b"
      onInvite={() => router.push("/(b2b)/add-colleague")}
      onManageColleagues={() => router.push("/(b2b)/colleagues")}
    />
```

`src/app/(backoffice)/(tabs)/settings.tsx` — same addition with `onManageColleagues={() => router.push("/(backoffice)/colleagues")}`, keeping the existing `onManageCompanies` and stubbed `onInvite`.

- [ ] **Step 6: Regenerate the typed routes**

New route files mean `.expo/types/router.d.ts` is stale and `tsc` cannot resolve the new `href`s. Start the dev server long enough for it to rewrite them, then stop it:

Run: `npx expo start --clear` — wait until it prints the QR code / "Waiting on…", then press `Ctrl+C`.

- [ ] **Step 7: Run the app gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: green **except** unresolved `href` errors for `/(b2b)/colleagues/${uid}` and `/(backoffice)/colleagues/${uid}` — those routes arrive in Task 9. If any other error appears, fix it before committing.

- [ ] **Step 8: Commit**

```bash
git add src/components src/app
git commit -m "feat: Mes collaborateurs list and its Paramètres entry point

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: "Collaborateur" management page

**Files:**
- Create: `src/components/screens/ColleagueScreen.tsx`, `src/app/(b2b)/colleagues/[uid].tsx`, `src/app/(backoffice)/colleagues/[uid].tsx`

**Interfaces:**
- Consumes: `useUser`, `roleLabel`, `callSetColleagueAdmin`, `callDeleteColleague` (Task 6); `ConfirmModal`, `AccountInfoList` with `roleLabel` (Task 7).
- Produces: `<ColleagueScreen uid canManage onDeleted? />`; routes `/(b2b)/colleagues/[uid]` and `/(backoffice)/colleagues/[uid]`.

- [ ] **Step 1: Write the screen**

```tsx
// src/components/screens/ColleagueScreen.tsx
import AccountInfoList from "@/components/native/AccountInfoList";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ScreenMessage from "@/components/ui/ScreenMessage";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { ScreenLoader } from "@/components/ui/Spinner";
import { roleLabel } from "@/lib/data/colleagues";
import { useUser } from "@/lib/data/useUser";
import { callDeleteColleague, callSetColleagueAdmin } from "@/lib/data/users";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { alertDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView } from "react-native";

interface Props {
  uid: string;
  /** `false` renders the read-only back-office view: info only, no buttons. */
  canManage: boolean;
  /** Called after a successful deletion — the route pops back to the list. */
  onDeleted?: () => void;
}

/** One colleague: their information, and (for an admin) the two actions on
 *  them. Owns its header title, because only this screen has read the name. */
export default function ColleagueScreen({ uid, canManage, onDeleted }: Props) {
  const { data, loading, error } = useUser(uid);
  const [confirming, setConfirming] = useState(false);

  // One action per button, so the button that is working is the one that spins;
  // `busy` then locks the other — same pattern as the company page.
  const onError = (message: string) => alertDialog("Action impossible", message);
  const toggling = useAsyncAction(async (next: boolean) => {
    await callSetColleagueAdmin(uid, next);
  }, { onError });
  const deleting = useAsyncAction(async () => {
    await callDeleteColleague(uid);
    onDeleted?.();
  }, { onError });
  const busy = toggling.pending || deleting.pending;

  if (loading) return <ScreenLoader />;
  if (error) return <ScreenMessage message={error} tone="danger" />;
  if (!data) return <ScreenMessage message="Utilisateur introuvable." />;

  const fullName = `${data.nom} ${data.prenom}`;
  return (
    <ScrollView>
      <Stack.Screen
        options={headerOptions({
          title: canManage ? "Collaborateur" : `Détails ${fullName}`,
        })}
      />
      <SectionWrapper>
        <Section title="Information collaborateur">
          <AccountInfoList user={data} roleLabel={roleLabel(data)} />
        </Section>

        {canManage ? (
          <Section title="Gérer ce collaborateur">
            <Button
              label={
                data.isAdmin ? "Retirer rôle Administrateur" : "Ajouter rôle Administrateur"
              }
              onPress={() => void toggling.run(!data.isAdmin)}
              loading={toggling.pending}
              disabled={busy}
            />
            <Button
              variant="danger"
              label="Supprimer utilisateur"
              onPress={() => setConfirming(true)}
              loading={deleting.pending}
              // An admin account cannot be deleted — remove the role first.
              disabled={busy || data.isAdmin}
            />
          </Section>
        ) : null}
      </SectionWrapper>

      <ConfirmModal
        visible={confirming}
        title="Supprimer cet utilisateur ?"
        message={`Êtes-vous sûr de vouloir supprimer l'utilisateur ${fullName} ?`}
        confirmLabel="Supprimer utilisateur"
        disabled={busy}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void deleting.run();
        }}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Add both management routes**

```tsx
// src/app/(b2b)/colleagues/[uid].tsx
import ColleagueScreen from "@/components/screens/ColleagueScreen";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function B2bColleague() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  return (
    <ColleagueScreen
      uid={uid}
      canManage
      onDeleted={() => router.replace("/(b2b)/colleagues")}
    />
  );
}
```

```tsx
// src/app/(backoffice)/colleagues/[uid].tsx
import ColleagueScreen from "@/components/screens/ColleagueScreen";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function BackofficeColleague() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const router = useRouter();
  return (
    <ColleagueScreen
      uid={uid}
      canManage
      onDeleted={() => router.replace("/(backoffice)/colleagues")}
    />
  );
}
```

`router.replace`, not `back()`: the deleted user's detail page must not stay on the stack.

- [ ] **Step 3: Regenerate the typed routes**

Run: `npx expo start --clear` — wait for it to boot, then `Ctrl+C`.

- [ ] **Step 4: Run the app gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green, including the Task 8 `href`s that were failing.

- [ ] **Step 5: Commit**

```bash
git add src/components src/app
git commit -m "feat: Collaborateur page with admin toggle and user deletion

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Back-office user detail + "Entreprise" page revamp

**Files:**
- Create: `src/app/(backoffice)/users/[uid].tsx`
- Modify: `src/app/(backoffice)/companies/[id].tsx:1-16`, `:46-51`, `:92-125`

**Interfaces:**
- Consumes: `ColleagueScreen` (Task 9), `ColleagueCard` (Task 7), `useCompanyUsers` (existing).
- Produces: route `/(backoffice)/users/[uid]` (read-only detail).

- [ ] **Step 1: Add the read-only route**

```tsx
// src/app/(backoffice)/users/[uid].tsx
import ColleagueScreen from "@/components/screens/ColleagueScreen";
import { useLocalSearchParams } from "expo-router";

/** A company's user, seen from the back-office: information only. Managing a
 *  company's users is that company's admin's job, not Bike-eco's. */
export default function BackofficeUserDetail() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  return <ColleagueScreen uid={uid} canManage={false} />;
}
```

- [ ] **Step 2: Replace the two user sections on the company page**

In `src/app/(backoffice)/companies/[id].tsx`:

Delete the `owner` and `otherUsers` computation (lines 46-51) entirely.

Rename the company section's title:

```tsx
        <Section title="Information Entreprise">
          <CompanyInfoList company={company.data} />
        </Section>
```

Delete the `{owner ? (<Section title="Information vendeur admin">…</Section>) : null}` block, and delete the `<Section title="Autres utilisateurs de cette entreprise">…</Section>` block from inside the `!isPending` fragment.

Add, immediately after the "Information Entreprise" section (outside the `!isPending` branch — it replaces the admin block, which was visible while pending too):

```tsx
        <Section
          title="Vendeurs de cette entreprise"
          emptyMessage="Aucun utilisateur."
        >
          {users.data.map((u) => (
            <ColleagueCard
              key={u.id}
              user={u}
              actionLabel="Voir détails"
              onAction={() => router.push(`/(backoffice)/users/${u.id}`)}
            />
          ))}
        </Section>
```

The `!isPending` branch now holds only the "Gérer cette entreprise" section, so the surrounding `<>…</>` fragment can go.

- [ ] **Step 3: Fix the imports**

Add `import ColleagueCard from "@/components/ui/ColleagueCard";`. Remove the now-unused `AccountInfoList` import and, if nothing else uses them, `Text` and the `userLine` style.

- [ ] **Step 4: Regenerate the typed routes**

Run: `npx expo start --clear` — wait for it to boot, then `Ctrl+C`.

- [ ] **Step 5: Run the app gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green. Lint catches any import left unused by Step 3.

- [ ] **Step 6: Commit**

```bash
git add src/app
git commit -m "feat: rebuild the back-office Entreprise page around colleague cards

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Self-deletion on "Mon compte"

**Files:**
- Modify: `src/components/screens/AccountScreen.tsx`

**Interfaces:**
- Consumes: `callDeleteMyAccount` (Task 6), `ConfirmModal` (Task 7), `useSession().signOut`.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Wire the action**

In `src/components/screens/AccountScreen.tsx`, add the imports:

```tsx
import ConfirmModal from "@/components/ui/ConfirmModal";
import { callDeleteMyAccount } from "@/lib/data/users";
import { useState } from "react";
import { StyleSheet, Text, ScrollView } from "react-native";
```

(keep the existing `ScrollView` / `StyleSheet` import — just add `Text`.)

Inside the component, next to the other actions:

```tsx
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // The server deletes the Auth user, which invalidates this session; sign out
  // explicitly so the guard routes to sign-in instead of leaving a dead session.
  const deletingAccount = useAsyncAction(
    async () => {
      await callDeleteMyAccount();
      await signOut();
    },
    { onError: (message) => alertDialog("Suppression impossible", message) },
  );
```

- [ ] **Step 2: Render the guarded button**

Replace the existing bottom-pinned `<Button … label="Supprimer mon compte" …/>` with:

```tsx
        {/* Outside <Section> on purpose: the auto margin needs a growing
            parent, and SectionWrapper is the one that fills the viewport. */}
        <View style={styles.toBottom}>
          <Button
            variant="danger"
            label="Supprimer mon compte"
            onPress={() => setConfirmingDelete(true)}
            loading={deletingAccount.pending}
            // An admin account cannot be deleted: the company would be left
            // with nobody able to manage its team.
            disabled={data.isAdmin || deletingAccount.pending}
          />
          {data.isAdmin ? (
            <Text style={styles.adminNote}>
              Un administrateur ne peut pas supprimer son compte. Transférez d&apos;abord le
              rôle administrateur à un collaborateur.
            </Text>
          ) : null}
        </View>
```

Add `View` to the `react-native` import, and these styles:

```tsx
  toBottom: { marginTop: "auto", gap: tokens.space.sm },
  adminNote: { fontSize: 13, color: tokens.colors.muted },
```

(`tokens` is already imported? If not, add `import { tokens } from "@/theme/tokens";`.)

- [ ] **Step 3: Add the confirmation modal**

Just before the closing `</ScrollView>`:

```tsx
      <ConfirmModal
        visible={confirmingDelete}
        title="Supprimer mon compte ?"
        message="Cette action supprime définitivement votre compte. Vos dossiers et vos conversations sont conservés."
        confirmLabel="Supprimer mon compte"
        disabled={deletingAccount.pending}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          void deletingAccount.run();
        }}
      />
```

- [ ] **Step 4: Run the app gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add src/components/screens/AccountScreen.tsx
git commit -m "feat: wire self-deletion on Mon compte, blocked for admins

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Documentation, skills, and the full gate

Specs are the source of truth for this codebase and must land with the feature.

**Files:**
- Create: `docs/specs/page-colleagues.md`, `docs/specs/page-colleague.md`, `docs/specs/component-card-colleague.md`
- Modify: `docs/specs/page-settings.md`, `docs/specs/page-company.md`, `docs/specs/page-my-account.md`, `docs/specs/component-card-company.md`, `docs/tech/firestore-data-model.md`, `docs/ops/manage-accounts.md`, `docs/ops/first-backoffice-account.md`, `AGENTS.md`, and the three project skills below.

- [ ] **Step 1: Write `docs/specs/page-colleagues.md`**

Follow the shape of `docs/specs/page-list-companies.md`:

```markdown
# B2B and Back-office "Mes collaborateurs" page specifications

## Navbar props

- Left : left arrow (back to page-settings)
- middle : "Mes collaborateurs"
- right : none

## Main section

- Section "Mes collaborateurs" props :
  - Title : "Mes collaborateurs"
  - Content : one "Colleague" card per other user of the signed-in user's company
    (b2b) or of the Bike-eco team (back-office), ordered by nom then prénom. The
    signed-in user is never listed — they manage their own account on page-my-account.
  - Message if no entries : "Aucun collaborateur pour le moment."

Each card carries a "Gérer" button **only when the signed-in user is an administrator**;
it opens page-colleague. A non-admin sees the same list without buttons.

## Loading and error states

The section owns its own spinner, mapped French error, and empty message
(component-section).

## Tab bar props

Same as page-settings.
```

- [ ] **Step 2: Write `docs/specs/page-colleague.md`**

```markdown
# "Collaborateur" page specifications

Reached from page-colleagues ("Gérer", administrators only) and, in read-only mode,
from the "Vendeurs de cette entreprise" section of page-company ("Voir détails").

## Navbar props

- Left : left arrow
- middle : "Collaborateur" in management mode; "Détails [Nom] [Prénom]" in the
  back-office read-only mode
- right : none

## Main section

- Section "Information collaborateur" props :
  - A compact list of label/value rows : Nom / Prénom / Email / Téléphone / Rôle
    ("Administrateur", "Vendeur" for a b2b account, "Membre" for a back-office one).

Management mode only :

- Section "Gérer ce collaborateur" props :
  - Primary button : "Ajouter rôle Administrateur" when the colleague is not an
    administrator, "Retirer rôle Administrateur" when they are. The server refuses
    to remove the last administrator of a company (or of the Bike-eco team).
  - Red button : "Supprimer utilisateur", **disabled when the colleague is an
    administrator** (an administrator account cannot be deleted). It opens a
    confirmation modal — "Supprimer cet utilisateur ?" / "Êtes-vous sûr de vouloir
    supprimer l'utilisateur [Nom] [Prénom] ?" / "Annuler" (primary) /
    "Supprimer utilisateur" (red) — and deletes the Firebase Authentication user and
    the `users/{uid}` document. **Dossiers, conversations and stored documents are
    kept**: they carry the submitter's and sender's identity denormalized, and
    Storage is company-prefixed.

## Loading and error states

Centered spinner while the user document is read; the mapped French error on a failed
read; "Utilisateur introuvable." when the document does not exist. While an action runs
every button is locked and the working one shows a spinner; a failure surfaces in an
"Action impossible" dialog.
```

- [ ] **Step 3: Write `docs/specs/component-card-colleague.md`**

```markdown
# Colleague's Card specifications

Card UI is identical to component-card-company. Each card represents a user.

Colleague's Card props :

- title : "[Nom] [Prénom]"
- subtitle : "Rôle: [Administrateur|Vendeur|Membre]"
- right : optional button — "Gérer" on page-colleagues (administrators only, opens
  page-colleague), "Voir détails" on page-company (opens page-colleague read-only).
  With no button the card is plain, non-clickable information.
```

- [ ] **Step 4: Update the existing specs**

`docs/specs/page-settings.md` — under both "B2B" and "Bike-eco Backoffice" in the main
section, add: `- Button secondary : "Voir mes collaborateurs" (link to page-colleagues)`
under a "Mes collaborateurs" heading. Under B2B, note that "Supprimer son compte" lives
on page-my-account.

`docs/specs/page-company.md` — replace the "Information vendeur" / "Information vendeur
admin" / "Autres utilisateurs de cette entreprise" bullets with:

```markdown
- Section "Information Entreprise" props :
  - All form information related to the company : a compact list of label/value rows

- Section "Vendeurs de cette entreprise" props :
  - One "Colleague" card per user of this company, each with a "Voir détails" button
    opening page-colleague in read-only mode. Shown for pending companies too — it is
    where the applicant's email and téléphone are read before validating.
  - Message if no entries : "Aucun utilisateur."
```

`docs/specs/page-my-account.md` — replace the "Not available yet." sentence on
"Supprimer mon compte" with: the button opens a confirmation modal ("Supprimer mon
compte ?" / "Cette action supprime définitivement votre compte. Vos dossiers et vos
conversations sont conservés." / "Annuler" / "Supprimer mon compte"), then deletes the
account and signs the user out. It is **disabled for an administrator**, with the line
"Un administrateur ne peut pas supprimer son compte. Transférez d'abord le rôle
administrateur à un collaborateur."

`docs/specs/component-card-company.md` — add a line noting the visual is shared with
component-card-colleague via `EntityCard`.

`docs/tech/firestore-data-model.md` — document `isAdmin` on `users`: server-set, `true`
for the company registrant and for back-office accounts, `false` for invited colleagues;
never client-writable; not mirrored into custom claims.

`docs/ops/manage-accounts.md` — document `scripts/grant-b2b.js --admin true` and the
rule that the account is an administrator when the script creates the company. Add a
paragraph on in-app deletion: an administrator deletes a colleague from
"Mes collaborateurs", which keeps dossiers, chats and Storage — unlike
`scripts/delete-b2b-user.js`, which also deletes the user's dossiers.

`docs/ops/first-backoffice-account.md` — document that `grant-backoffice.js` creates an
administrator by default and `--no-admin true` creates a plain member.

`AGENTS.md` — add the three new specs to the "Page specs" / "Component specs" lists.

- [ ] **Step 5: Update the project skills**

The skills live in `.claude/skills/<name>/SKILL.md`:

- `.claude/skills/bike-eco-data/SKILL.md` — the `users/{uid}` read rule now includes teammates; `isAdmin` is
  server-set and non-client-writable; `useColleagues` / `useUser` exist.
- `.claude/skills/bike-eco-functions/SKILL.md` — the `functions/src/users/` module and
  its three callables; `RegError` / `CallerClaims` now live in `functions/src/errors.ts`.
- `.claude/skills/bike-eco-auth/SKILL.md` — admin gating: `session.isAdmin` drives the "Gérer" button; the
  server re-checks it from the profile document, never from claims.

Keep each edit to a few lines; do not restructure the skills.

- [ ] **Step 6: Run every gate**

Run, from the repo root:

```bash
npx tsc --noEmit && npx expo lint && npm test
npm run test:rules
cd functions && npm run build && npm test && npm run lint
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add docs AGENTS.md .claude
git commit -m "docs: specs and runbooks for user management

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Manual verification (after Task 12)

Not automated — the house style does not render-test screens. Run against the emulators
(`npm run seed` after starting them) or a scratch project:

1. Sign in as a company owner → Paramètres shows "Mes collaborateurs" → the list shows
   the invited colleague with "Rôle: Vendeur" and a "Gérer" button; the owner is absent.
2. Sign in as the invited colleague → the same list shows the owner, with **no** "Gérer"
   button.
3. As the owner, open the colleague → "Ajouter rôle Administrateur" → the subtitle flips
   to "Rôle: Administrateur" and "Supprimer utilisateur" becomes disabled.
4. Remove the role again, then delete the colleague → back on the list, the colleague is
   gone; the dossier they submitted is still on the dashboard, still opens, and its chat
   history still shows their name.
5. As that deleted colleague, signing in fails.
6. As a non-admin, "Mon compte" → "Supprimer mon compte" → confirm → the app returns to
   sign-in. As an admin, the button is disabled with the explanatory line.
7. As back-office, open a company → "Vendeurs de cette entreprise" lists its users;
   "Voir détails" opens "Détails [Nom] [Prénom]" with no action buttons.
