# Back-office Company Management (Slice 4b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Bike-eco back office the UI + backend to approve/decline pending company registrations and to cascade-delete an established company.

**Architecture:** Two new authenticated Cloud Functions callables (`approveCompany`, `deleteCompany`) built as thin `onCall` wrappers over pure `core` functions with injected `Deps` (the 4a pattern). `companies` gains `departement`/`region`/`validatedAt`/`createdByName`, derived at registration. New back-office client screens (companies list + detail), a pending banner, and a settings entry point read `companies` via a live `useCompanies` hook and mutate via callable wrappers.

**Tech Stack:** Expo Router + React Native, Firebase (Auth + named `bike-eco-db` Firestore + Storage), 2nd-gen Cloud Functions (`onCall`), Zod v4, Jest.

## Global Constraints

- App data lives in the **named `bike-eco-db`** database, never `(default)`. In functions, `db()` = `getFirestore(getApp(), "bike-eco-db")`.
- `role`/`companyId`/`status` are **server-set Auth custom claims**, never client-writable. `companies` is `allow write: if false` — every company mutation runs Admin-SDK-side in a callable.
- Callables require an authenticated caller; `approveCompany`/`deleteCompany` additionally require `claims.role === "backoffice"` and `claims.status === "active"`.
- All user-facing copy is **French**, matching the specs verbatim.
- Errors surface as `HttpsError` with French messages; the client maps `functions/*` codes to French in `src/lib/data/registration.ts`.
- Firestore `orderBy(field)` silently **excludes documents missing that field** — every `active` company must carry `validatedAt`, or it won't appear in the "Vendeurs enregistrées" list.
- TDD: write the failing test first for every unit of pure logic. UI screens (no RN render tests exist in this repo) are verified by `npx tsc --noEmit` + `npx expo lint` + a manual emulator walkthrough.

---

### Task 1: Extend the `Company` data model

**Files:**

- Modify: `src/lib/firestore/schema.ts`

**Interfaces:**

- Produces: `Company` gains `departement: string`, `region: Region`, `validatedAt: Timestamp | null`, `createdByName: string`; `COMPANY_STATUSES = ["pending", "active"] as const`.

- [ ] **Step 1: Trim `COMPANY_STATUSES`**

In `src/lib/firestore/schema.ts`, change:

```ts
export const COMPANY_STATUSES = ["pending", "active", "rejected"] as const;
```

to:

```ts
// Decline hard-deletes the applicant (frees the SIRET), so a company only ever
// exists in `pending` or `active` — there is no persisted `rejected` state.
export const COMPANY_STATUSES = ["pending", "active"] as const;
```

- [ ] **Step 2: Add the new `Company` fields**

Replace the `Company` interface body with:

```ts
export interface Company {
  siret: string; // 14 digits, immutable
  name: string;
  status: CompanyStatus; // manual validation by the Bike-eco team
  departement: string; // "33 - Gironde" — captured at registration
  region: Region; // derived from departement; drives back-office routing
  createdBy: string; // uid of the first registrant
  createdByName: string; // denormalized "prénom nom" for the company card subtitle
  validatedAt: Timestamp | null; // set on approve; null while pending
  createdAt: Timestamp;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (consumers of the new fields land in later tasks; existing code still compiles).

- [ ] **Step 4: Commit**

```bash
git add src/lib/firestore/schema.ts
git commit -m "feat(schema): add departement/region/validatedAt/createdByName to Company; trim statuses"
```

---

### Task 2: Registration writes the company region + new fields

**Files:**

- Modify: `functions/src/registration/schemas.ts`
- Modify: `functions/src/registration/core.ts`
- Test: `functions/src/registration/core.test.ts`

**Interfaces:**

- Consumes: `resolveRegion(departement)` from `functions/src/regions.ts`.
- Produces: `registerCompanyCore` now writes `departement`, `region`, `validatedAt: null`, `createdByName` on the company doc. `RegisterCompanyInput` gains optional `companyDepartement`.

- [ ] **Step 1: Add optional `companyDepartement` to the schema**

In `functions/src/registration/schemas.ts`, change the `registerCompanySchema` object to include the field:

```ts
export const registerCompanySchema = z
  .object({
    siret: z.string().regex(/^\d{14}$/),
    companyName: z.string().trim().min(1),
    // The company's own département (registration step 1). Optional so older
    // clients still register — core falls back to the user's `departement`.
    companyDepartement: z.string().trim().min(1).optional(),
    ...profile,
  })
  .and(registerCredential);
```

- [ ] **Step 2: Update the failing test first**

In `functions/src/registration/core.test.ts`, replace the first test's assertions to expect the new company fields:

```ts
test("registerCompany (password) creates pending company+user, pins claims, emails applicant", async () => {
  const d = fakeDeps();
  await registerCompanyCore(companyInput, null, null, d);
  expect(d.calls.companies["comp_new"]).toMatchObject({
    siret: "12345678901234",
    status: "pending",
    createdBy: "uid_new",
    departement: "75 - Paris",
    region: "NORTH",
    createdByName: "Camille Durand",
    validatedAt: null,
  });
  expect(d.calls.users["uid_new"]).toMatchObject({
    role: "b2b",
    companyId: "comp_new",
    status: "pending",
  });
  expect(d.calls.claims).toEqual({
    uid: "uid_new",
    claims: { role: "b2b", companyId: "comp_new", status: "pending" },
  });
  expect(d.calls.emails).toEqual([
    { kind: "applicant", to: "c@x.fr", name: "Garage X" },
  ]);
});
```

(`companyInput.departement` is `"75 - Paris"`, code `75` → `NORTH`.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd functions && npx jest src/registration/core.test.ts -t "creates pending company"`
Expected: FAIL — company doc lacks `region`/`departement`/`createdByName`/`validatedAt`.

- [ ] **Step 4: Implement the region derivation in core**

In `functions/src/registration/core.ts`, add the import at the top:

```ts
import { resolveRegion } from "../regions";
```

Then in `registerCompanyCore`, replace the `writeCompany` call:

```ts
const companyId = deps.newCompanyId();
const companyDepartement = input.companyDepartement ?? input.departement;
await deps.writeCompany(companyId, {
  siret: input.siret,
  name: input.companyName,
  status: "pending",
  departement: companyDepartement,
  region: resolveRegion(companyDepartement),
  createdBy: uid,
  createdByName: `${input.prenom} ${input.nom}`,
  validatedAt: null,
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd functions && npx jest src/registration/core.test.ts`
Expected: PASS (all core tests).

- [ ] **Step 6: Commit**

```bash
git add functions/src/registration/schemas.ts functions/src/registration/core.ts functions/src/registration/core.test.ts
git commit -m "feat(functions): registerCompany derives + stores company region and fields"
```

---

### Task 3: `approveCompanyCore` (pure logic + tests)

**Files:**

- Create: `functions/src/registration/backoffice.ts`
- Test: `functions/src/registration/backoffice.test.ts`
- Modify: `functions/src/registration/core.ts` (extend `RegErrorCode`)

**Interfaces:**

- Consumes: `RegError`, `RegErrorCode`, `CallerClaims` from `./core`.
- Produces: `BackofficeDeps` interface; `approveCompanyCore(companyId: string, caller: CallerClaims, deps: BackofficeDeps): Promise<void>`.

- [ ] **Step 1: Add `"failed-precondition"` to `RegErrorCode`**

In `functions/src/registration/core.ts`, change:

```ts
export type RegErrorCode =
  | "unauthenticated"
  | "permission-denied"
  | "already-exists"
  | "invalid-argument"
  | "not-found";
```

to:

```ts
export type RegErrorCode =
  | "unauthenticated"
  | "permission-denied"
  | "already-exists"
  | "invalid-argument"
  | "not-found"
  | "failed-precondition";
```

- [ ] **Step 2: Write the failing test**

Create `functions/src/registration/backoffice.test.ts`:

```ts
import { approveCompanyCore, type BackofficeDeps } from "./backoffice";
import type { CallerClaims } from "./core";

const boCaller: CallerClaims = {
  uid: "bo1",
  role: "backoffice",
  status: "active",
  companyId: null,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fakeDeps(
  over: Partial<BackofficeDeps> = {},
): BackofficeDeps & { calls: any } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any = { activated: [], emails: [], order: [] };
  return {
    calls,
    getCompany: async () => ({ name: "Garage X", status: "pending" }),
    getPendingCompanyUsers: async () => [
      { uid: "owner1", email: "owner@x.fr" },
    ],
    activateUser: async (uid) => {
      calls.activated.push(uid);
      calls.order.push(`activate:${uid}`);
    },
    setCompanyActive: async (id) => {
      calls.companyActive = id;
      calls.order.push(`company:${id}`);
    },
    sendApprovalEmail: async (to, name) => {
      calls.emails.push({ to, name });
    },
    deleteStorage: async () => {
      throw new Error("must not be called");
    },
    deleteDossiers: async () => {
      throw new Error("must not be called");
    },
    deleteUsers: async () => {
      throw new Error("must not be called");
    },
    deleteCompany: async () => {
      throw new Error("must not be called");
    },
    ...over,
  };
}

test("approveCompany activates the owner + company and emails the applicant", async () => {
  const d = fakeDeps();
  await approveCompanyCore("comp_1", boCaller, d);
  expect(d.calls.activated).toEqual(["owner1"]);
  expect(d.calls.companyActive).toBe("comp_1");
  expect(d.calls.emails).toEqual([{ to: "owner@x.fr", name: "Garage X" }]);
});

test("approveCompany rejects a non-backoffice caller", async () => {
  const d = fakeDeps();
  await expect(
    approveCompanyCore(
      "comp_1",
      { uid: "u", role: "b2b", status: "active", companyId: "c" },
      d,
    ),
  ).rejects.toMatchObject({ code: "permission-denied" });
});

test("approveCompany rejects a company that is not pending", async () => {
  const d = fakeDeps({
    getCompany: async () => ({ name: "Garage X", status: "active" }),
  });
  await expect(approveCompanyCore("comp_1", boCaller, d)).rejects.toMatchObject(
    { code: "failed-precondition" },
  );
});

test("approveCompany rejects an unknown company", async () => {
  const d = fakeDeps({ getCompany: async () => null });
  await expect(approveCompanyCore("nope", boCaller, d)).rejects.toMatchObject({
    code: "not-found",
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd functions && npx jest src/registration/backoffice.test.ts`
Expected: FAIL — `./backoffice` does not exist.

- [ ] **Step 4: Implement `backoffice.ts` (approve only for now)**

Create `functions/src/registration/backoffice.ts`:

```ts
import { RegError, type CallerClaims } from "./core";

export interface BackofficeDeps {
  getCompany(id: string): Promise<{ name: string; status: string } | null>;
  getPendingCompanyUsers(
    companyId: string,
  ): Promise<{ uid: string; email: string }[]>;
  activateUser(uid: string): Promise<void>;
  setCompanyActive(id: string): Promise<void>;
  sendApprovalEmail(to: string, companyName: string): Promise<void>;
  deleteStorage(companyId: string): Promise<void>;
  deleteDossiers(companyId: string): Promise<void>;
  deleteUsers(companyId: string): Promise<void>;
  deleteCompany(id: string): Promise<void>;
}

function assertBackoffice(caller: CallerClaims): void {
  if (caller.role !== "backoffice" || caller.status !== "active") {
    throw new RegError(
      "permission-denied",
      "Action réservée à l'équipe Bike-eco.",
    );
  }
}

export async function approveCompanyCore(
  companyId: string,
  caller: CallerClaims,
  deps: BackofficeDeps,
): Promise<void> {
  assertBackoffice(caller);
  const company = await deps.getCompany(companyId);
  if (!company) throw new RegError("not-found", "Entreprise introuvable.");
  if (company.status !== "pending") {
    throw new RegError(
      "failed-precondition",
      "Cette entreprise n'est pas en attente de validation.",
    );
  }
  const users = await deps.getPendingCompanyUsers(companyId);
  for (const user of users) await deps.activateUser(user.uid);
  await deps.setCompanyActive(companyId);
  if (users.length > 0)
    await deps.sendApprovalEmail(users[0].email, company.name);
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd functions && npx jest src/registration/backoffice.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add functions/src/registration/backoffice.ts functions/src/registration/backoffice.test.ts functions/src/registration/core.ts
git commit -m "feat(functions): approveCompanyCore + failed-precondition error code"
```

---

### Task 4: `deleteCompanyCore` (pure cascade logic + tests)

**Files:**

- Modify: `functions/src/registration/backoffice.ts`
- Test: `functions/src/registration/backoffice.test.ts`

**Interfaces:**

- Produces: `deleteCompanyCore(companyId: string, caller: CallerClaims, deps: BackofficeDeps): Promise<void>` — invokes the four teardown deps in order: `deleteStorage` → `deleteDossiers` → `deleteUsers` → `deleteCompany`.

- [ ] **Step 1: Write the failing test**

Extend the existing `./backoffice` import at the top of `functions/src/registration/backoffice.test.ts` to add `deleteCompanyCore` (avoid a second `import` from the same module — `no-duplicate-imports`):

```ts
import {
  approveCompanyCore,
  deleteCompanyCore,
  type BackofficeDeps,
} from "./backoffice";
```

Then append the cascade tests:

```ts
function cascadeDeps(over: Partial<BackofficeDeps> = {}) {
  const order: string[] = [];
  const deps: BackofficeDeps = {
    getCompany: async () => ({ name: "Garage X", status: "active" }),
    getPendingCompanyUsers: async () => [],
    activateUser: async () => {},
    setCompanyActive: async () => {},
    sendApprovalEmail: async () => {},
    deleteStorage: async () => {
      order.push("storage");
    },
    deleteDossiers: async () => {
      order.push("dossiers");
    },
    deleteUsers: async () => {
      order.push("users");
    },
    deleteCompany: async () => {
      order.push("company");
    },
    ...over,
  };
  return { deps, order };
}

test("deleteCompany cascades storage → dossiers → users → company", async () => {
  const { deps, order } = cascadeDeps();
  await deleteCompanyCore("comp_1", boCaller, deps);
  expect(order).toEqual(["storage", "dossiers", "users", "company"]);
});

test("deleteCompany rejects a non-backoffice caller", async () => {
  const { deps } = cascadeDeps();
  await expect(
    deleteCompanyCore(
      "comp_1",
      { uid: "u", role: "b2b", status: "active", companyId: "c" },
      deps,
    ),
  ).rejects.toMatchObject({ code: "permission-denied" });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd functions && npx jest src/registration/backoffice.test.ts -t "deleteCompany"`
Expected: FAIL — `deleteCompanyCore` is not exported.

- [ ] **Step 3: Implement `deleteCompanyCore`**

Append to `functions/src/registration/backoffice.ts`:

```ts
export async function deleteCompanyCore(
  companyId: string,
  caller: CallerClaims,
  deps: BackofficeDeps,
): Promise<void> {
  assertBackoffice(caller);
  // Storage first: even if a later step fails, we never leave orphaned files
  // that no Firestore doc points at. Storage is company-prefixed
  // (`dossiers/{companyId}/...`), so one prefixed delete covers every photo,
  // thumbnail, and message attachment.
  await deps.deleteStorage(companyId);
  await deps.deleteDossiers(companyId);
  await deps.deleteUsers(companyId);
  await deps.deleteCompany(companyId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd functions && npx jest src/registration/backoffice.test.ts`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add functions/src/registration/backoffice.ts functions/src/registration/backoffice.test.ts
git commit -m "feat(functions): deleteCompanyCore cascade"
```

---

### Task 5: Wire the `approveCompany` / `deleteCompany` callables

**Files:**

- Modify: `functions/src/registration/schemas.ts`
- Modify: `functions/src/registration/emails.ts`
- Modify: `functions/src/registration/index.ts`
- Modify: `functions/src/index.ts` (re-export)

**Interfaces:**

- Consumes: `approveCompanyCore`, `deleteCompanyCore`, `BackofficeDeps` from `./backoffice`; `sendApprovalEmail` from `./emails`.
- Produces: deployed callables `approveCompany({ companyId }) → { ok: true }` and `deleteCompany({ companyId }) → { ok: true }`.

- [ ] **Step 1: Add the payload schema**

In `functions/src/registration/schemas.ts`, append:

```ts
export const companyActionSchema = z.object({
  companyId: z.string().trim().min(1),
});
export type CompanyActionInput = z.infer<typeof companyActionSchema>;
```

- [ ] **Step 2: Add the approval email**

In `functions/src/registration/emails.ts`, append:

```ts
export async function sendApprovalEmail(
  to: string,
  companyName: string,
): Promise<void> {
  await sendMail({
    to,
    subject: "Bike-eco — Votre compte est validé",
    text:
      `Bonjour,\n\nBonne nouvelle : le compte de ${companyName} a été validé par notre équipe. ` +
      `Vous pouvez dès à présent vous connecter à l'application pour vendre vos véhicules.\n\n` +
      `L'équipe Bike-eco`,
  });
}
```

- [ ] **Step 3: Wire the callables + real deps**

In `functions/src/registration/index.ts`:

Add imports (top of file, alongside the existing admin imports):

```ts
import { getStorage } from "firebase-admin/storage";
```

Extend the `./backoffice`, `./emails`, and `./schemas` imports:

```ts
import {
  approveCompanyCore,
  deleteCompanyCore,
  type BackofficeDeps,
} from "./backoffice";
import {
  sendApplicantEmail,
  sendApprovalEmail,
  sendInviteEmail,
} from "./emails";
import {
  acceptInviteSchema,
  companyActionSchema,
  registerCompanySchema,
  resolveInviteSchema,
  sendInviteSchema,
} from "./schemas";
```

Extend the existing `./core` import (near the top of the file) to also bring in the `CallerClaims` type — do **not** add a second import statement from `./core`:

```ts
import {
  acceptInviteCore,
  RegError,
  registerCompanyCore,
  resolveInviteCore,
  sendInviteCore,
  type CallerClaims,
  type Deps,
  type StoredInvitation,
} from "./core";
```

Add a `CallerClaims` builder and the backoffice deps factory (after `realDeps()`):

```ts
function callerFrom(req: {
  auth?: { uid: string; token: Record<string, unknown> };
}): CallerClaims {
  const token = req.auth!.token;
  return {
    uid: req.auth!.uid,
    role: token.role as string,
    status: token.status as string,
    companyId: (token.companyId as string) ?? null,
  };
}

function backofficeDeps(): BackofficeDeps {
  return {
    getCompany: async (id) => {
      const snap = await db().collection("companies").doc(id).get();
      if (!snap.exists) return null;
      const d = snap.data()!;
      return { name: d.name, status: d.status };
    },
    getPendingCompanyUsers: async (companyId) => {
      const snap = await db()
        .collection("users")
        .where("companyId", "==", companyId)
        .where("status", "==", "pending")
        .get();
      return snap.docs.map((doc) => ({
        uid: doc.id,
        email: doc.data().email as string,
      }));
    },
    activateUser: async (uid) => {
      await db().collection("users").doc(uid).update({
        status: "active",
        updatedAt: FieldValue.serverTimestamp(),
      });
      const existing = (await getAuth().getUser(uid)).customClaims ?? {};
      await getAuth().setCustomUserClaims(uid, {
        ...existing,
        status: "active",
      });
    },
    setCompanyActive: async (id) => {
      await db().collection("companies").doc(id).update({
        status: "active",
        validatedAt: FieldValue.serverTimestamp(),
      });
    },
    sendApprovalEmail,
    deleteStorage: async (companyId) => {
      await getStorage()
        .bucket()
        .deleteFiles({ prefix: `dossiers/${companyId}/` });
    },
    deleteDossiers: async (companyId) => {
      const snap = await db()
        .collection("dossiers")
        .where("companyId", "==", companyId)
        .get();
      await Promise.all(snap.docs.map((doc) => db().recursiveDelete(doc.ref)));
    },
    deleteUsers: async (companyId) => {
      const snap = await db()
        .collection("users")
        .where("companyId", "==", companyId)
        .get();
      await Promise.all(
        snap.docs.map(async (doc) => {
          await getAuth()
            .deleteUser(doc.id)
            .catch(() => undefined); // Auth user may already be gone
          await doc.ref.delete();
        }),
      );
    },
    deleteCompany: async (id) => {
      await db().collection("companies").doc(id).delete();
    },
  };
}
```

Add the two callables (after `acceptInvite`):

```ts
export const approveCompany = onCall(
  { secrets: B2C_EMAIL_SECRETS },
  async (req) => {
    if (!req.auth)
      throw new HttpsError("unauthenticated", "Connexion requise.");
    try {
      const { companyId } = companyActionSchema.parse(req.data);
      await approveCompanyCore(companyId, callerFrom(req), backofficeDeps());
      return { ok: true };
    } catch (e) {
      toHttps(e);
    }
  },
);

export const deleteCompany = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const { companyId } = companyActionSchema.parse(req.data);
    await deleteCompanyCore(companyId, callerFrom(req), backofficeDeps());
    return { ok: true };
  } catch (e) {
    toHttps(e);
  }
});
```

- [ ] **Step 4: Extend `toHttps` for the new error code**

In `functions/src/registration/index.ts`, the `RegError` branch already forwards `err.code` to `HttpsError`; `"failed-precondition"` is a valid `HttpsError` code, so no change is needed there. Confirm the branch reads:

```ts
if (err instanceof RegError) throw new HttpsError(err.code, err.message);
```

- [ ] **Step 5: Re-export from the functions entrypoint**

In `functions/src/index.ts`, change the re-export line to:

```ts
export {
  registerCompany,
  sendInvite,
  resolveInvite,
  acceptInvite,
  approveCompany,
  deleteCompany,
} from "./registration";
```

- [ ] **Step 6: Build + lint the functions package**

Run: `cd functions && npm run build && npm run lint`
Expected: PASS (tsc emits, eslint clean).

- [ ] **Step 7: Commit**

```bash
git add functions/src
git commit -m "feat(functions): approveCompany + deleteCompany callables"
```

---

### Task 6: Client callable wrappers

**Files:**

- Modify: `src/lib/data/registration.ts`

**Interfaces:**

- Produces: `callApproveCompany(companyId: string): Promise<void>`, `callDeleteCompany(companyId: string): Promise<void>`.

- [ ] **Step 1: Map the new error code**

In `src/lib/data/registration.ts`, add to the `messages` record in `frenchError`:

```ts
    "functions/failed-precondition": "Cette entreprise n'est pas en attente de validation.",
```

- [ ] **Step 2: Add the wrappers**

Append to `src/lib/data/registration.ts`:

```ts
export const callApproveCompany = (companyId: string) =>
  call<{ companyId: string }, { ok: true }>("approveCompany", {
    companyId,
  }).then(() => undefined);
export const callDeleteCompany = (companyId: string) =>
  call<{ companyId: string }, { ok: true }>("deleteCompany", {
    companyId,
  }).then(() => undefined);
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/registration.ts
git commit -m "feat(data): approveCompany/deleteCompany callable wrappers"
```

---

### Task 7: Live company hooks + region selector + indexes

**Files:**

- Create: `src/lib/data/selectCompanies.ts`
- Create: `src/lib/data/selectCompanies.test.ts`
- Create: `src/lib/data/useCompanies.ts`
- Modify: `firestore.indexes.json`

**Interfaces:**

- Consumes: `companiesRef`, `WithId` from `@/lib/firestore/collections`; `useAuth`; `useRegionFilter`.
- Produces: `filterCompaniesByRegion(list, region)`; `useCompanies(status: CompanyStatus, region?: Region | null): { data: WithId<Company>[]; loading: boolean; error: string | null }`; `useCompany(id)`; `useCompanyUsers(companyId)`.

- [ ] **Step 1: Write the failing test for the pure selector**

Create `src/lib/data/selectCompanies.test.ts`:

```ts
import { filterCompaniesByRegion } from "./selectCompanies";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

const make = (id: string, region: "NORTH" | "SOUTH"): WithId<Company> =>
  ({ id, region }) as WithId<Company>;

test("null region keeps every company", () => {
  const list = [make("a", "NORTH"), make("b", "SOUTH")];
  expect(filterCompaniesByRegion(list, null).map((c) => c.id)).toEqual([
    "a",
    "b",
  ]);
});

test("a region keeps only matching companies", () => {
  const list = [make("a", "NORTH"), make("b", "SOUTH")];
  expect(filterCompaniesByRegion(list, "SOUTH").map((c) => c.id)).toEqual([
    "b",
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/data/selectCompanies.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the selector**

Create `src/lib/data/selectCompanies.ts`:

```ts
import type { WithId } from "@/lib/firestore/collections";
import type { Company, Region } from "@/lib/firestore/schema";

/**
 * Region filtering for the back-office companies list. Applied client-side
 * (companies are a small set) so the queries need only `status + orderBy`
 * composite indexes. `null` region = "Toute la France" = no filter.
 */
export function filterCompaniesByRegion(
  companies: WithId<Company>[],
  region: Region | null,
): WithId<Company>[] {
  if (!region) return companies;
  return companies.filter((c) => c.region === region);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/lib/data/selectCompanies.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement the hooks**

Create `src/lib/data/useCompanies.ts`:

```ts
import { useEffect, useState } from "react";
import {
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
  type FirestoreError,
} from "firebase/firestore";

import {
  companiesRef,
  usersRef,
  type WithId,
} from "@/lib/firestore/collections";
import type {
  AppUser,
  Company,
  CompanyStatus,
  Region,
} from "@/lib/firestore/schema";
import { mapDataError } from "./dataErrors";
import { filterCompaniesByRegion } from "./selectCompanies";

/**
 * Live company list for the back office. Pending companies sort oldest-first
 * (createdAt asc); active companies sort by most-recent validation
 * (validatedAt desc) — so every active company must carry `validatedAt`.
 * Region is filtered client-side (see `filterCompaniesByRegion`).
 */
export function useCompanies(status: CompanyStatus, region?: Region | null) {
  const [resolved, setResolved] = useState<{
    status: CompanyStatus;
    data: WithId<Company>[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    const q =
      status === "pending"
        ? query(
            companiesRef,
            where("status", "==", "pending"),
            orderBy("createdAt", "asc"),
          )
        : query(
            companiesRef,
            where("status", "==", "active"),
            orderBy("validatedAt", "desc"),
          );
    return onSnapshot(
      q,
      (snap) =>
        setResolved({
          status,
          data: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ status, data: [], error: mapDataError(err.code) }),
    );
  }, [status]);

  const loading = resolved?.status !== status;
  return {
    data: loading
      ? []
      : filterCompaniesByRegion(resolved!.data, region ?? null),
    loading,
    error: loading ? null : resolved!.error,
  };
}

/** Single company document, live. */
export function useCompany(id: string) {
  const [resolved, setResolved] = useState<{
    id: string;
    data: WithId<Company> | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    return onSnapshot(
      doc(companiesRef, id),
      (snap) =>
        setResolved({
          id,
          data: snap.exists() ? { ...snap.data(), id: snap.id } : null,
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ id, data: null, error: mapDataError(err.code) }),
    );
  }, [id]);

  const loading = resolved?.id !== id;
  return {
    data: loading ? null : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}

/** All users of a company, live. */
export function useCompanyUsers(companyId: string) {
  const [resolved, setResolved] = useState<{
    companyId: string;
    data: WithId<AppUser>[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    return onSnapshot(
      query(usersRef, where("companyId", "==", companyId)),
      (snap) =>
        setResolved({
          companyId,
          data: snap.docs.map((d) => ({ ...d.data(), id: d.id })),
          error: null,
        }),
      (err: FirestoreError) =>
        setResolved({ companyId, data: [], error: mapDataError(err.code) }),
    );
  }, [companyId]);

  const loading = resolved?.companyId !== companyId;
  return {
    data: loading ? [] : resolved!.data,
    loading,
    error: loading ? null : resolved!.error,
  };
}
```

- [ ] **Step 6: Add the composite indexes**

In `firestore.indexes.json`, add two entries to the `indexes` array:

```json
    {
      "collectionGroup": "companies",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "companies",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "validatedAt", "order": "DESCENDING" }
      ]
    }
```

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/data/selectCompanies.ts src/lib/data/selectCompanies.test.ts src/lib/data/useCompanies.ts firestore.indexes.json
git commit -m "feat(data): useCompanies/useCompany/useCompanyUsers hooks + indexes"
```

---

### Task 8: Seed pending + active companies for manual testing

**Files:**

- Modify: `scripts/seed.ts`

**Interfaces:**

- Produces: emulator data containing at least one `pending` company (approvable/declinable) and `active` companies carrying `region`/`departement`/`validatedAt`/`createdByName`.

- [ ] **Step 1: Add the new fields to existing company docs**

In `scripts/seed.ts`, update every `companies/...` `.set({...})` call to include the new fields. For `comp_nord`:

```ts
await db.doc(`companies/comp_nord`).set({
  siret: "11111111111111",
  name: "Garage du Nord",
  status: "active",
  departement: "75 - Paris",
  region: "NORTH",
  createdBy: "user_b2b",
  createdByName: "Camille Durand",
  validatedAt: now,
  createdAt: now,
});
```

For `comp_sud`, mirror it with `departement: "13 - Bouches-du-Rhône"`, `region: "SOUTH"`, `createdBy`/`createdByName` matching its seeded owner, `validatedAt: now`.

- [ ] **Step 2: Add a genuinely pending company + owner**

In `scripts/seed.ts`, after the existing seeds, add:

```ts
// A pending company for exercising the 4b validation loop.
await db.doc(`companies/comp_pending`).set({
  siret: "22222222222222",
  name: "Garage Nouveau",
  status: "pending",
  departement: "33 - Gironde",
  region: "SOUTH",
  createdBy: "user_pending_owner",
  createdByName: "Alex Martin",
  validatedAt: null,
  createdAt: now,
});
await db.doc(`users/user_pending_owner`).set({
  role: "b2b",
  companyId: "comp_pending",
  region: null,
  nom: "Martin",
  prenom: "Alex",
  email: "alex@nouveau.fr",
  telephone: "0655667788",
  departement: "33 - Gironde",
  ville: "Bordeaux",
  status: "pending",
  createdAt: now,
  updatedAt: now,
});
```

- [ ] **Step 3: Run the seed against the emulator**

Ensure the Firestore emulator is running (`JAVA_HOME=/usr/local/jdk-26.0.1 npx firebase-tools@latest emulators:start`), then:

Run: `npm run seed`
Expected: completes without error; `comp_pending` exists with `status: "pending"`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "chore(seed): company region/validatedAt fields + a pending company"
```

---

### Task 9: `CompanyCard` + `CompaniesSection` components

**Files:**

- Create: `src/components/ui/CompanyCard.tsx`
- Create: `src/components/ui/CompaniesSection.tsx`

**Interfaces:**

- Consumes: `WithId<Company>`, `tokens`.
- Produces: `CompanyCard({ title, subtitle, onManage })`; `CompaniesSection({ title, companies, loading, emptyMessage, renderCard })`.

- [ ] **Step 1: Implement `CompanyCard`**

Create `src/components/ui/CompanyCard.tsx` (mirrors `DossierCard`, but the right slot is a "Gérer" button instead of a thumbnail — per `component-card-company.md`):

```tsx
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  subtitle: string;
  onManage: () => void;
}

export default function CompanyCard({ title, subtitle, onManage }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.manage}
        onPress={onManage}
        activeOpacity={0.7}
      >
        <Text style={styles.manageText}>Gérer</Text>
      </TouchableOpacity>
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
  manage: {
    paddingHorizontal: tokens.space.md,
    paddingVertical: tokens.space.sm,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.primary,
  },
  manageText: {
    color: tokens.colors.primaryText,
    fontSize: 14,
    fontWeight: "600",
  },
});
```

- [ ] **Step 2: Implement `CompaniesSection`**

Create `src/components/ui/CompaniesSection.tsx` (mirrors `DossiersSection`):

```tsx
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  companies: WithId<Company>[];
  loading: boolean;
  emptyMessage: string;
  renderCard: (c: WithId<Company>) => ReactNode;
}

export default function CompaniesSection({
  title,
  companies,
  loading,
  emptyMessage,
  renderCard,
}: Props) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {loading ? (
        <ActivityIndicator
          style={styles.spinner}
          color={tokens.colors.primary}
        />
      ) : companies.length === 0 ? (
        <Text style={styles.empty}>{emptyMessage}</Text>
      ) : (
        <View style={styles.list}>{companies.map(renderCard)}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.space.md },
  title: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
  spinner: { paddingVertical: tokens.space.lg },
  empty: { fontSize: 14, color: tokens.colors.muted },
  list: { gap: tokens.space.md },
});
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/CompanyCard.tsx src/components/ui/CompaniesSection.tsx
git commit -m "feat(ui): CompanyCard + CompaniesSection"
```

---

### Task 10: Companies list screen + route

**Files:**

- Create: `src/app/(backoffice)/companies/index.tsx`
- Modify: `src/app/(backoffice)/_layout.tsx`

**Interfaces:**

- Consumes: `useCompanies`, `useRegionFilter`, `CompaniesSection`, `CompanyCard`.
- Produces: route `/(backoffice)/companies` rendering the two-section list.

- [ ] **Step 1: Implement the list screen**

Create `src/app/(backoffice)/companies/index.tsx`:

```tsx
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

import CompaniesSection from "@/components/ui/CompaniesSection";
import CompanyCard from "@/components/ui/CompanyCard";
import { useCompanies } from "@/lib/data/useCompanies";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

export default function CompaniesListScreen() {
  const router = useRouter();
  const { region } = useRegionFilter();
  const pending = useCompanies("pending", region);
  const active = useCompanies("active", region);

  const card = (c: WithId<Company>) => (
    <CompanyCard
      key={c.id}
      title={c.name}
      subtitle={c.createdByName}
      onManage={() => router.push(`/(backoffice)/companies/${c.id}`)}
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <CompaniesSection
        title="Vendeurs à valider"
        companies={pending.data}
        loading={pending.loading}
        emptyMessage="Pas de vendeur a valider pour le moment."
        renderCard={card}
      />
      <CompaniesSection
        title="Vendeurs enregistrées"
        companies={active.data}
        loading={active.loading}
        emptyMessage="Pas de vendeur enregistrée pour le moment."
        renderCard={card}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.xl },
});
```

- [ ] **Step 2: Register the routes in the back-office layout**

In `src/app/(backoffice)/_layout.tsx`, add two `Stack.Screen` entries inside the `<Stack>` (the native back button + title provide the specced navbar):

```tsx
      <Stack.Screen name="companies/index" options={{ title: "Vendeurs enregistrées" }} />
      <Stack.Screen name="companies/[id]" options={{ title: "Vendeur" }} />
```

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 4: Manual verification**

With emulators + seed running and signed in as the back-office user, navigate to `/(backoffice)/companies`. Expected: "Vendeurs à valider" shows _Garage Nouveau_ (Alex Martin); "Vendeurs enregistrées" shows the active companies. Set "Région gérée" to "Moitié sud" in settings → only SOUTH companies remain.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(backoffice)/companies/index.tsx" "src/app/(backoffice)/_layout.tsx"
git commit -m "feat(backoffice): companies list screen + routes"
```

---

### Task 11: Company detail screen (approve / decline / delete)

**Files:**

- Create: `src/components/native/CompanyInfoList.tsx`
- Create: `src/app/(backoffice)/companies/[id].tsx`
- Modify: `docs/specs/page-company.md`

**Interfaces:**

- Consumes: `useCompany`, `useCompanyUsers`, `callApproveCompany`, `callDeleteCompany`, `AccountInfoList`.
- Produces: route `/(backoffice)/companies/[id]` with the pending and approved branches.

- [ ] **Step 1: Implement the company info list**

Create `src/components/native/CompanyInfoList.tsx` (mirrors `AccountInfoList`):

```tsx
import { Column, Host, Row, Spacer, Text } from "@expo/ui";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

const LABEL = { fontSize: 14, color: "#71727A" } as const;
const VALUE = { fontSize: 14, fontWeight: "500", color: "#111" } as const;

export default function CompanyInfoList({
  company,
}: {
  company: WithId<Company>;
}) {
  const rows: [string, string][] = [
    ["Entreprise", company.name],
    ["SIRET", company.siret],
    ["Département", company.departement],
    ["Région", company.region === "NORTH" ? "Nord" : "Sud"],
  ];
  return (
    <Host matchContents>
      <Column spacing={12}>
        {rows.map(([label, value]) => (
          <Row key={label} spacing={16}>
            <Text textStyle={LABEL}>{label}</Text>
            <Spacer flexible />
            <Text textStyle={VALUE}>{value}</Text>
          </Row>
        ))}
      </Column>
    </Host>
  );
}
```

- [ ] **Step 2: Implement the detail screen**

Create `src/app/(backoffice)/companies/[id].tsx`:

```tsx
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import Button from "@/components/ui/Button";
import { callApproveCompany, callDeleteCompany } from "@/lib/data/registration";
import { useCompany, useCompanyUsers } from "@/lib/data/useCompanies";
import { tokens } from "@/theme/tokens";

export default function CompanyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const company = useCompany(id);
  const users = useCompanyUsers(id);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (company.loading || users.loading) {
    return (
      <ActivityIndicator style={styles.center} color={tokens.colors.primary} />
    );
  }
  if (!company.data) {
    return <Text style={styles.center}>Entreprise introuvable.</Text>;
  }

  const owner =
    users.data.find((u) => u.id === company.data!.createdBy) ?? users.data[0];
  const isPending = company.data.status === "pending";

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      router.back();
    } catch (err) {
      Alert.alert(
        "Action impossible",
        err instanceof Error ? err.message : "Veuillez réessayer.",
      );
    } finally {
      setBusy(false);
    }
  }

  function onDecline() {
    Alert.alert(
      "Décliner l'inscription",
      "Cette entreprise et son compte seront définitivement supprimés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Décliner",
          style: "destructive",
          onPress: () => run(() => callDeleteCompany(id)),
        },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {isPending ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Voulez-vous autoriser cette entreprise à vendre des véhicules
          </Text>
          <View style={styles.row}>
            <Button
              label="Autoriser"
              onPress={() => run(() => callApproveCompany(id))}
              style={styles.flex}
              disabled={busy}
            />
            <Button
              variant="outlined"
              label="Décliner inscription"
              onPress={onDecline}
              style={styles.flex}
              disabled={busy}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Information vendeur</Text>
        <CompanyInfoList company={company.data} />
      </View>

      {owner ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information vendeur admin</Text>
          <AccountInfoList user={owner} />
        </View>
      ) : null}

      {!isPending ? (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Autres utilisateurs de cette entreprise
            </Text>
            {users.data.length === 0 ? (
              <Text style={styles.empty}>Aucun autre utilisateur.</Text>
            ) : (
              users.data.map((u) => (
                <Text
                  key={u.id}
                  style={styles.userLine}
                >{`${u.prenom} ${u.nom} — ${u.email}`}</Text>
              ))
            )}
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gérer cette entreprise</Text>
            <Button
              variant="text"
              label="Supprimer cette entreprise"
              onPress={() => setConfirmDelete(true)}
              style={styles.danger}
              disabled={busy}
            />
          </View>
        </>
      ) : null}

      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Supprimer cette entreprise ?</Text>
            <Text style={styles.modalBody}>
              Cette action supprime définitivement l'entreprise, ses
              utilisateurs, tous ses dossiers, les conversations et les
              documents stockés.
            </Text>
            <Button
              label="Annuler"
              onPress={() => setConfirmDelete(false)}
              disabled={busy}
            />
            <Button
              variant="text"
              label="Tout supprimer"
              onPress={() => {
                setConfirmDelete(false);
                void run(() => callDeleteCompany(id));
              }}
              style={styles.danger}
              disabled={busy}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.xl },
  center: {
    flex: 1,
    textAlignVertical: "center",
    textAlign: "center",
    padding: tokens.space.xl,
  },
  section: { gap: tokens.space.md },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.colors.primary,
  },
  row: { flexDirection: "row", gap: tokens.space.md },
  flex: { flex: 1 },
  empty: { fontSize: 14, color: tokens.colors.muted },
  userLine: { fontSize: 14, color: tokens.colors.primary },
  danger: { alignSelf: "flex-start" },
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
  modalTitle: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
  modalBody: { fontSize: 14, color: tokens.colors.muted },
});
```

- [ ] **Step 3: Sync the spec**

In `docs/specs/page-company.md`, add a line under the pending-section description noting: "Both _Décliner inscription_ and _Supprimer cette entreprise_ call the same server `deleteCompany` cascade (hard-delete: users + dossiers + chats + stored documents). _Décliner_ is the pending-state entry point; _Supprimer_ the active-state one."

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Signed in as back-office: open _Garage Nouveau_ → tap **Autoriser** → returns to the list, the company moves to "Vendeurs enregistrées", and (with `DEV_EMAIL_OVERRIDE`) the approval email is logged. Open an active company → **Supprimer cette entreprise** → confirm modal → **Tout supprimer** → the company disappears and its dossiers/users are gone. Re-seed, then try **Décliner** on the pending company → it disappears and its SIRET is reusable.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(backoffice)/companies/[id].tsx" src/components/native/CompanyInfoList.tsx docs/specs/page-company.md
git commit -m "feat(backoffice): company detail — approve/decline/delete"
```

---

### Task 12: Pending banner + settings entry point

**Files:**

- Create: `src/components/ui/PendingCompaniesBanner.tsx`
- Modify: `src/components/screens/DashboardScreen.tsx`
- Modify: `src/app/(backoffice)/(tabs)/dashboard.tsx`
- Modify: `src/components/form/SettingsList.tsx`
- Modify: `src/components/screens/SettingsScreen.tsx`
- Modify: `src/app/(backoffice)/(tabs)/settings.tsx`
- Modify: `docs/specs/page-dashboard.md`, `docs/specs/page-settings.md`

**Interfaces:**

- Consumes: `useCompanies`, `useRegionFilter`.
- Produces: `PendingCompaniesBanner({ onPress })`; `DashboardScreen` gains optional `onOpenCompanies?: () => void`; `SettingsList`/`SettingsScreen` gain optional `onManageCompanies?: () => void`.

- [ ] **Step 1: Create a back-office-only banner component**

Create `src/components/ui/PendingCompaniesBanner.tsx`. It **must** be its own component (not a hook call inside the shared `DashboardScreen`): `useCompanies` issues a `companies` list query, and security rules **deny** that query for b2b users — so the hook can only ever mount inside a back-office-only branch.

```tsx
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useCompanies } from "@/lib/data/useCompanies";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import { tokens } from "@/theme/tokens";

/** Back-office only. Renders nothing until there is ≥1 pending registration. */
export default function PendingCompaniesBanner({
  onPress,
}: {
  onPress: () => void;
}) {
  const { region } = useRegionFilter();
  const pending = useCompanies("pending", region);
  if (pending.data.length === 0) return null;
  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <Text
        style={styles.bannerText}
      >{`${pending.data.length} nouveaux vendeurs à valider`}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.primary,
  },
  bannerText: {
    color: tokens.colors.primaryText,
    fontSize: 15,
    fontWeight: "700",
  },
});
```

- [ ] **Step 2: Render the banner in the back-office branch of `DashboardScreen`**

In `src/components/screens/DashboardScreen.tsx`, add the import, the optional prop, and render the banner as the first child of the back-office `ScrollView`.

Add import:

```ts
import PendingCompaniesBanner from "@/components/ui/PendingCompaniesBanner";
```

Change the `Props` interface:

```ts
interface Props {
  role: UserRole;
  onOpenDossier: (id: string) => void;
  onSell?: () => void;
  onOpenCompanies?: () => void;
}
```

Add `onOpenCompanies` to the destructure, and inside the `role === "backoffice"` branch's `ScrollView`, before the first `DossiersSection`:

```tsx
{
  onOpenCompanies ? <PendingCompaniesBanner onPress={onOpenCompanies} /> : null;
}
```

(No `useCompanies` call is added to `DashboardScreen` itself — the query lives entirely inside the banner component, which only renders for back-office.)

- [ ] **Step 3: Wire `onOpenCompanies` from the back-office dashboard route**

Replace `src/app/(backoffice)/(tabs)/dashboard.tsx` with:

```tsx
import { useRouter } from "expo-router";
import DashboardScreen from "@/components/screens/DashboardScreen";

export default function BackofficeDashboard() {
  const router = useRouter();
  return (
    <DashboardScreen
      role="backoffice"
      onOpenDossier={(id) => router.push(`/(backoffice)/dossier/${id}`)}
      onOpenCompanies={() => router.push("/(backoffice)/companies")}
    />
  );
}
```

- [ ] **Step 4: Add the settings button**

In `src/components/form/SettingsList.tsx`, add `onManageCompanies?: () => void` to `Props`, destructure it, and render a back-office-only button above the "Région gérée" dropdown:

```tsx
{
  role === "backoffice" ? (
    <Button
      variant="outlined"
      label="Gérer les entreprises"
      onPress={() => onManageCompanies?.()}
    />
  ) : null;
}
```

- [ ] **Step 5: Thread the prop through `SettingsScreen`**

In `src/components/screens/SettingsScreen.tsx`, add `onManageCompanies?: () => void` to `Props`, accept it, and pass it to `SettingsList`:

```tsx
export default function SettingsScreen({
  role,
  onInvite,
  onDelete,
  onSignOut,
  onManageCompanies,
}: Props) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <SettingsList
        role={role}
        onInvite={onInvite}
        onDelete={onDelete}
        onSignOut={onSignOut}
        onManageCompanies={onManageCompanies}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 6: Wire it from the back-office settings route**

In `src/app/(backoffice)/(tabs)/settings.tsx`, add the router and pass `onManageCompanies`:

```tsx
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import SettingsScreen from "@/components/screens/SettingsScreen";
import { useSession } from "@/lib/data/useSession";

export default function BackofficeSettings() {
  const router = useRouter();
  const { signOut } = useSession();
  return (
    <SettingsScreen
      role="backoffice"
      onManageCompanies={() => router.push("/(backoffice)/companies")}
      onInvite={() =>
        Alert.alert(
          "Inviter un collègue",
          "Action non disponible pour le moment.",
        )
      }
      onDelete={() =>
        Alert.alert(
          "Supprimer son compte",
          "Action non disponible pour le moment.",
        )
      }
      onSignOut={signOut}
    />
  );
}
```

- [ ] **Step 7: Sync the specs**

In `docs/specs/page-settings.md` (Bike-eco Backoffice section) add, above "Région gérée": `- Button secondary : "Gérer les entreprises" (link to page-list-companies)`. In `docs/specs/page-dashboard.md`, note that the pending banner count and companies list are region-filtered via `company.region` (derived from the company's département at registration).

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 9: Manual verification**

As back-office with the seeded pending company: the dashboard shows a "1 nouveaux vendeurs à valider" banner → tap → companies list. Paramètres shows "Gérer les entreprises" → tap → companies list. Approve the pending company → the banner disappears.

- [ ] **Step 10: Commit**

```bash
git add src/components/screens/DashboardScreen.tsx "src/app/(backoffice)/(tabs)/dashboard.tsx" src/components/form/SettingsList.tsx src/components/screens/SettingsScreen.tsx "src/app/(backoffice)/(tabs)/settings.tsx" docs/specs/page-dashboard.md docs/specs/page-settings.md
git commit -m "feat(backoffice): pending banner + Gérer les entreprises settings entry"
```

---

### Task 13: Capture the company département at registration

**Files:**

- Modify: `src/features/b2b-registration/schema.ts`
- Modify: `src/features/b2b-registration/steps.tsx`
- Modify: `src/features/b2b-registration/submit.ts`
- Modify: `src/lib/data/registration.ts`
- Modify: `src/app/(auth)/register.tsx`
- Test: `src/features/b2b-registration/__tests__/schema.test.ts`
- Modify: `docs/specs/form-b2b-company-registration.md`

**Interfaces:**

- Consumes: `DEPARTMENTS`, `ControlledDropdown`.
- Produces: the form carries `companyDepartement`, sent to `registerCompany`; step 3's user `departement` pre-fills from it.

- [ ] **Step 1: Write the failing schema test**

In `src/features/b2b-registration/__tests__/schema.test.ts`, add (adjust the import if the file already imports the schema/defaults):

```ts
import {
  b2bCompanyRegistrationSchema,
  B2B_COMPANY_REGISTRATION_DEFAULTS,
} from "../schema";

test("companyDepartement is required", () => {
  const result = b2bCompanyRegistrationSchema.safeParse({
    ...B2B_COMPANY_REGISTRATION_DEFAULTS,
    siret: "12345678901234",
    companyName: "Garage X",
    companyDepartement: "",
    email: "a@b.fr",
    password: "password123",
    nom: "N",
    prenom: "P",
    telephone: "0600000000",
    departement: "75 - Paris",
    ville: "Paris",
  });
  expect(result.success).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/b2b-registration/__tests__/schema.test.ts -t "companyDepartement"`
Expected: FAIL — `companyDepartement` is not in the schema.

- [ ] **Step 3: Add the field to the schema + defaults**

In `src/features/b2b-registration/schema.ts`, add to the object (after `companyName`):

```ts
  companyDepartement: requiredText("Sélectionnez le département de l'entreprise"),
```

and to `B2B_COMPANY_REGISTRATION_DEFAULTS` (after `companyName: ""`):

```ts
  companyDepartement: "",
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/features/b2b-registration/__tests__/schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the step-1 dropdown**

In `src/features/b2b-registration/steps.tsx`, import the dropdown + departments and add the field inside `EntrepriseFields`, and add `companyDepartement` to step 1's `fields`:

```tsx
import ControlledDropdown from "@/components/form/ControlledDropdown";
import { DEPARTMENTS } from "@/constants/departments";
```

```tsx
function EntrepriseFields() {
  return (
    <>
      <ControlledField
        name="siret"
        label="Numéro SIRET *"
        placeholder="14 chiffres"
        keyboardType="numeric"
        maxLength={14}
        transform={digitsOnly(14)}
        returnKeyType="next"
      />
      <ControlledField
        name="companyName"
        label="Nom de votre entreprise *"
        placeholder="Nom de votre entreprise"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <ControlledDropdown
        name="companyDepartement"
        label="Département *"
        placeholder="Département"
        options={DEPARTMENTS}
        searchable
      />
      <Text style={styles.note}>* Champs obligatoires</Text>
    </>
  );
}
```

Update step 1's `fields`:

```tsx
    fields: ["siret", "companyName", "companyDepartement"],
```

- [ ] **Step 6: Pre-fill the user département + send the field**

In `src/app/(auth)/register.tsx`, pre-fill the user `departement` from `companyDepartement` when the user hasn't set it. Add, inside the component after `useStepForm`:

```tsx
const companyDept = form.watch("companyDepartement");
useEffect(() => {
  if (companyDept && !form.getValues("departement")) {
    form.setValue("departement", companyDept);
  }
}, [companyDept, form]);
```

Add `useEffect` to the React import. Then add `companyDepartement` to the Google-path payload in the same file:

```tsx
await callRegisterCompany({
  method: "google",
  siret: values.siret,
  companyName: values.companyName,
  companyDepartement: values.companyDepartement,
  nom: values.nom,
  prenom: values.prenom,
  telephone: values.telephone,
  departement: values.departement,
  ville: values.ville,
});
```

- [ ] **Step 7: Send the field on the password path + extend the payload type**

In `src/lib/data/registration.ts`, add `companyDepartement?: string;` to `RegisterCompanyPayload`. In `src/features/b2b-registration/submit.ts`, add to the `callRegisterCompany({...})` object:

```ts
    companyDepartement: values.companyDepartement,
```

- [ ] **Step 8: Sync the form spec**

In `docs/specs/form-b2b-company-registration.md`, add the "Département\*" dropdown field to step 1 (after "Nom de votre entreprise", same values list as step 3), and note on step 3 that "Département" pre-fills from the step-1 company département and stays editable.

- [ ] **Step 9: Typecheck + lint + full test run**

Run: `npx tsc --noEmit && npx expo lint && npx jest src/features/b2b-registration`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/features/b2b-registration src/lib/data/registration.ts "src/app/(auth)/register.tsx" docs/specs/form-b2b-company-registration.md
git commit -m "feat(registration): capture company département in step 1 + prefill user field"
```

---

## Owner setup (post-merge, cannot be automated here)

1. Deploy functions: `cd functions && npm run deploy` (adds `approveCompany`, `deleteCompany`, `sendApprovalEmail`).
2. Deploy indexes: `npx firebase-tools@latest deploy --only firestore:indexes --project <prod>`.
3. Any pre-existing **live** companies predate `region`/`departement`/`validatedAt`/`createdByName` — active ones without `validatedAt` won't list. Run a one-off Admin-SDK backfill (mirror the seed's field set) or re-create them; dev data is handled by the updated seed script.
4. **Launch hardening:** enforce App Check on `approveCompany` / `deleteCompany` alongside the 4a callables — see `launch-hardening-todo`.

## Verification summary

- Functions unit tests: `cd functions && npx jest` (registerCompany region write, approveCompany, deleteCompany cascade + auth guards).
- Client unit tests: `npx jest src/lib/data/selectCompanies.test.ts src/features/b2b-registration`.
- Typecheck/lint: `npx tsc --noEmit && npx expo lint`; functions `npm run build && npm run lint`.
- Manual walkthrough (emulators + seed): banner → list → approve/decline/delete, settings entry, region filter, and a fresh company registration that lands with a stored region.
