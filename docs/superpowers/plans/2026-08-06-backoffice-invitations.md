# Back-office Invitations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a back-office admin invite a new Bike-eco team member through the existing invitation flow, and restrict sending invitations to admins for both roles.

**Architecture:** The `invitations/{id}` document gains a required `role` and a nullable `companyId`. The three invitation callable cores (`sendInviteCore`, `resolveInviteCore`, `acceptInviteCore`) become role-aware; the invited-registration funnel is shared unchanged and only its final destination and two subtitles depend on the role. The client gets a back-office "Inviter un collègue" route, and the Paramètres invite section is hidden from non-admins.

**Tech Stack:** Expo (SDK 56) + Expo Router typed routes, React Hook Form + Zod v4, Firebase Cloud Functions v2 callables (Admin SDK), Firestore named database `bike-eco-db`, Jest.

**Design spec:** `docs/superpowers/specs/2026-08-06-backoffice-invitations-design.md` — read it before starting.

## Global Constraints

- **Verification gate** (run before considering any task done): `npx tsc --noEmit && npx expo lint && npm test`. All three must be green. See `docs/tech/verification.md`.
- **Adding a route file under `src/app/` requires regenerating typed routes** before `tsc` can resolve its `href` — bare `tsc` does not do it. Exact commands are in Task 5.
- **Jest globals are imported explicitly** in this repo: `import { describe, expect, test } from "@jest/globals";` — `functions/src/registration/core.test.ts` already relies on the ambient globals it was written with; follow the file's existing style and do not add an import it does not have.
- **House testing convention:** pure logic is unit-tested (function cores, Zod schemas, pure helpers); screens, components and `use*` hooks that only wrap `onSnapshot` are gated by `tsc` + lint only. Do **not** add render tests for the new screens.
- **All user-facing copy is French**, and must be used verbatim as written in this plan. A change that alters a feature's behaviour updates its spec under `docs/specs/` in the **same commit**.
- **`role`, `companyId`, `status` are server-set Auth custom claims; `isAdmin` is server-set and lives only on the `users/{uid}` document, never in claims.**
- **There are no invitations in the live database**, so `role` is a required field with no missing-value fallback.
- Back-office custom claims are exactly `{ role: "backoffice", companyId: null, status: "active" }` (see `scripts/grant-backoffice.js`) — the invitation path must produce the same shape.
- Cloud Functions code lives in `functions/` and does **not** import from `src/`; the two type definitions are kept in sync by hand.

---

### Task 1: Role-aware invitations + admin-only `sendInvite`

Makes an invitation carry the role it grants, restricts sending to admins for both roles, and names the organisation in the invite email.

**Files:**
- Modify: `functions/src/registration/core.ts`
- Modify: `functions/src/registration/emails.ts:15-23`
- Modify: `functions/src/registration/index.ts:21-55`
- Modify: `src/lib/firestore/schema.ts:92-101`
- Modify: `docs/tech/firestore-data-model.md:82-92`
- Test: `functions/src/registration/core.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type InviteRole = "b2b" | "backoffice"` exported from `functions/src/registration/core.ts`
  - `const BIKE_ECO_ORGANISATION = "Bike-eco"` exported from the same file
  - `StoredInvitation` gains `role: InviteRole`, `companyId: string | null`, and replaces `companyName: string` with `companyName: string | null`
  - `Deps` gains `getUserIsAdmin(uid: string): Promise<boolean>` and `getCompanyName(companyId: string): Promise<string>`
  - `Deps.sendInviteEmail` becomes `(to: string, code: string, organisationName: string) => Promise<void>`

- [ ] **Step 1: Update the test fixture and the existing invite tests**

In `functions/src/registration/core.test.ts`, add the two new deps to `fakeDeps` (inside the returned object, next to the existing entries) and widen the recorded invite email:

```ts
    getUserIsAdmin: async () => true,
    getCompanyName: async () => "Garage X",
    sendInviteEmail: async (to, code, organisationName) => {
      calls.emails.push({ kind: "invite", to, code, organisationName });
    },
```

(The `sendInviteEmail` line replaces the existing one. Keep `...over` last.)

Then update the existing b2b send test so it asserts the new field — replace the body of `test("sendInvite writes a hashed, 1h invitation for an active b2b caller", …)` with:

```ts
  const d = fakeDeps();
  await sendInviteCore({ email: "new@x.fr" }, { role: "b2b", status: "active", companyId: "comp_1", uid: "u1" }, d);
  const [id] = Object.keys(d.calls.invitations);
  expect(d.calls.invitations[id]).toMatchObject({ email: "new@x.fr", role: "b2b", companyId: "comp_1", invitedBy: "u1", status: "pending", expiresAt: 1_000_000 + 3_600_000 });
  expect(d.calls.invitations[id].tokenHash).toMatch(/^[0-9a-f]{64}$/);
  expect(d.calls.emails[0]).toMatchObject({ kind: "invite", to: "new@x.fr", organisationName: "Garage X" });
```

Every other test in the file that builds a `StoredInvitation` literal now needs `role: "b2b"` to type-check. Add `role: "b2b" as const,` to each of these **six** literals:

1. `good` in `test("resolveInvite returns the email for a valid code and deletes an expired one", …)` — `expired` spreads `good`, so it needs no edit of its own;
2. `inv` in `test("acceptInvite creates an ACTIVE user in the invitation's company and deletes the invite", …)`;
3. `inv` in `test("acceptInvite (google) requires the Google email to match the invitation", …)`;
4. `inv` in `test("acceptInvite (google) with a matching email skips createUser and creates an active user", …)`;
5. `inv` in `test("google mode with no auth is rejected as unauthenticated (both flows)", …)`;
6. `inv` in `test("acceptInvite creates a non-admin colleague", …)`.

- [ ] **Step 2: Write the failing tests for the new behaviour**

Append to `functions/src/registration/core.test.ts`:

```ts
test("sendInvite refuses a non-admin caller, before writing or emailing anything", async () => {
  const d = fakeDeps({ getUserIsAdmin: async () => false });
  await expect(
    sendInviteCore({ email: "x@x.fr" }, { role: "b2b", status: "active", companyId: "comp_1", uid: "u1" }, d),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(d.calls.invitations).toEqual({});
  expect(d.calls.emails).toEqual([]);
});

test("sendInvite from a back-office admin writes a company-less back-office invitation", async () => {
  const d = fakeDeps({
    getCompanyName: async () => { throw new Error("must not be called"); },
  });
  await sendInviteCore({ email: "team@bike-eco.fr" }, { role: "backoffice", status: "active", companyId: null, uid: "bo1" }, d);
  const [id] = Object.keys(d.calls.invitations);
  expect(d.calls.invitations[id]).toMatchObject({
    email: "team@bike-eco.fr", role: "backoffice", companyId: null, invitedBy: "bo1", status: "pending",
  });
  expect(d.calls.emails[0]).toMatchObject({ kind: "invite", to: "team@bike-eco.fr", organisationName: "Bike-eco" });
});

test("sendInvite refuses a non-admin back-office caller", async () => {
  const d = fakeDeps({ getUserIsAdmin: async () => false });
  await expect(
    sendInviteCore({ email: "x@x.fr" }, { role: "backoffice", status: "active", companyId: null, uid: "bo1" }, d),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(d.calls.invitations).toEqual({});
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest functions/src/registration/core.test.ts`
Expected: FAIL — the new tests fail because `sendInviteCore` rejects a `backoffice` caller with "Seul un compte vendeur actif peut inviter." and never calls `getUserIsAdmin`; TypeScript also flags the unknown `getUserIsAdmin`/`getCompanyName` deps.

- [ ] **Step 4: Make the invitation type role-aware**

In `functions/src/registration/core.ts`, replace the `StoredInvitation` interface and add the two exports above it:

```ts
/** The organisation an invitee joins when the invitation grants back-office access. */
export const BIKE_ECO_ORGANISATION = "Bike-eco";

/** The role an invitation grants. A back-office invitation carries no company. */
export type InviteRole = "b2b" | "backoffice";

export interface StoredInvitation {
  id: string;
  email: string;
  role: InviteRole;
  companyId: string | null; // null for a back-office invitation
  companyName: string | null; // null for a back-office invitation
  tokenHash: string;
  expiresAt: number; // epoch ms
}
```

In the same file's `Deps` interface, add the two new deps and widen `sendInviteEmail`:

```ts
  /** `isAdmin` lives on `users/{uid}`, never in the claims — hence a read. */
  getUserIsAdmin(uid: string): Promise<boolean>;
  getCompanyName(companyId: string): Promise<string>;
```

and replace `sendInviteEmail(to: string, code: string): Promise<void>;` with:

```ts
  sendInviteEmail(to: string, code: string, organisationName: string): Promise<void>;
```

- [ ] **Step 5: Rewrite `sendInviteCore`**

Replace the whole `sendInviteCore` function in `functions/src/registration/core.ts` with:

```ts
export async function sendInviteCore(
  input: SendInviteInput,
  caller: CallerClaims,
  deps: Deps,
): Promise<void> {
  const role = caller.role;
  if ((role !== "b2b" && role !== "backoffice") || caller.status !== "active") {
    throw new RegError("permission-denied", "Seul un compte actif peut inviter.");
  }
  if (role === "b2b" && !caller.companyId) {
    throw new RegError("permission-denied", "Seul un compte vendeur actif peut inviter.");
  }
  // `isAdmin` is not a claim, so this is a document read — done before any
  // write or email so a refused caller leaves no trace at all.
  if (!(await deps.getUserIsAdmin(caller.uid))) {
    throw new RegError("permission-denied", "Seul un administrateur peut inviter.");
  }
  const companyId = role === "b2b" ? caller.companyId! : null;
  const organisationName = companyId
    ? await deps.getCompanyName(companyId)
    : BIKE_ECO_ORGANISATION;
  const code = generateInviteCode();
  const id = deps.newDocumentId();
  await deps.writeInvitation(id, {
    email: input.email, role, companyId, invitedBy: caller.uid,
    tokenHash: hashInviteCode(code), status: "pending", expiresAt: deps.now() + INVITE_TTL_MS,
  });
  await deps.sendInviteEmail(input.email, code, organisationName);
}
```

- [ ] **Step 6: Name the organisation in the invite email**

Replace `sendInviteEmail` in `functions/src/registration/emails.ts`:

```ts
export async function sendInviteEmail(
  to: string,
  code: string,
  organisationName: string,
): Promise<void> {
  await sendMail({
    to,
    subject: "Bike-eco — Vous êtes invité",
    text:
      `Bonjour,\n\nVous avez été invité à rejoindre ${organisationName} sur Bike-eco. ` +
      `Ouvrez l'application, choisissez "J'ai un code d'invitation" et saisissez ce code :\n\n` +
      `    ${code}\n\nCe code est valable 1 heure.\n\nL'équipe Bike-eco`,
  });
}
```

- [ ] **Step 7: Wire the two new real deps**

In `functions/src/registration/index.ts`, inside `realDeps()`, add next to the other entries (before the trailing `sendApplicantEmail, sendInviteEmail,`):

```ts
    getUserIsAdmin: async (uid) =>
      (await db().collection("users").doc(uid).get()).data()?.isAdmin === true,
    getCompanyName: async (companyId) =>
      ((await db().collection("companies").doc(companyId).get()).data()?.name as string) ?? "",
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx jest functions/src/registration/core.test.ts`
Expected: PASS — all tests in the file, including the three new ones.

Note: `findInvitationByHash` in `index.ts` still returns the old shape and will fail `tsc` until Task 2. That is expected; do not run the full gate yet. If you want a green intermediate state, run only `npx jest functions/src/registration/core.test.ts` here.

- [ ] **Step 9: Update the client type and the data-model doc**

In `src/lib/firestore/schema.ts`, replace the `Invitation` interface:

```ts
export interface Invitation {
  email: string;
  /** The role the invitee will be given. A back-office invitation has no company. */
  role: UserRole;
  companyId: string | null;
  invitedBy: string; // uid
  tokenHash: string; // store a hash, never the raw token
  status: InvitationStatus;
  expiresAt: Timestamp; // one-time, time-limited
  createdAt: Timestamp;
}
```

In `docs/tech/firestore-data-model.md`, in the `invitations/{invitationId}` table, replace the `companyId` row and add a `role` row above it:

```markdown
| `role` | string | `b2b` \| `backoffice` — the role the invitee will be given |
| `companyId` | string \| null | the inviter's company; **null** for a back-office invitation |
```

- [ ] **Step 10: Commit**

```bash
git add functions/src/registration/core.ts functions/src/registration/core.test.ts functions/src/registration/emails.ts functions/src/registration/index.ts src/lib/firestore/schema.ts docs/tech/firestore-data-model.md
git commit -m "feat: role-aware invitations, admin-only sendInvite"
```

---

### Task 2: `resolveInvite` returns the role and the organisation name

**Files:**
- Modify: `functions/src/registration/core.ts` (`resolveInviteCore`)
- Modify: `functions/src/registration/index.ts` (`findInvitationByHash` in `realDeps`)
- Modify: `src/lib/data/registration.ts:29-30`
- Test: `functions/src/registration/core.test.ts`

**Interfaces:**
- Consumes: `InviteRole`, `BIKE_ECO_ORGANISATION`, the updated `StoredInvitation` from Task 1.
- Produces:
  - `organisationNameOf(inv: StoredInvitation): string` exported from `functions/src/registration/core.ts`
  - `resolveInviteCore` now resolves to `{ email: string; role: InviteRole; organisationName: string }`
  - `callResolveInvite(code: string)` now resolves to `{ email: string; role: UserRole; organisationName: string }`

- [ ] **Step 1: Write the failing tests**

In `functions/src/registration/core.test.ts`, replace the first assertion line of the existing `test("resolveInvite returns the email for a valid code and deletes an expired one", …)` — the `resolves.toEqual` line — with:

```ts
  await expect(resolveInviteCore({ code: "a1b2c3" }, d)).resolves.toEqual({ email: "new@x.fr", role: "b2b", organisationName: "Garage X" });
```

Then append a new test:

```ts
test("resolveInvite names Bike-eco for a back-office invitation", async () => {
  const inv = {
    id: "inv2", email: "team@bike-eco.fr", role: "backoffice" as const, companyId: null,
    companyName: null, tokenHash: hashInviteCode("Z9Y8X7"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await expect(resolveInviteCore({ code: "Z9Y8X7" }, d)).resolves.toEqual({
    email: "team@bike-eco.fr", role: "backoffice", organisationName: "Bike-eco",
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest functions/src/registration/core.test.ts -t resolveInvite`
Expected: FAIL — received `{ email, companyName }`, expected `{ email, role, organisationName }`.

- [ ] **Step 3: Implement**

In `functions/src/registration/core.ts`, add the helper and replace `resolveInviteCore`:

```ts
/** The name shown to an invitee: their future company, or Bike-eco itself. */
export function organisationNameOf(inv: StoredInvitation): string {
  return inv.role === "backoffice" ? BIKE_ECO_ORGANISATION : (inv.companyName ?? "");
}

export async function resolveInviteCore(
  input: ResolveInviteInput,
  deps: Deps,
): Promise<{ email: string; role: InviteRole; organisationName: string }> {
  const inv = await deps.findInvitationByHash(hashInviteCode(input.code));
  if (!inv) throw new RegError("not-found", "Code d'invitation invalide ou expiré.");
  if (inv.expiresAt <= deps.now()) {
    await deps.deleteInvitation(inv.id);
    throw new RegError("not-found", "Code d'invitation invalide ou expiré.");
  }
  return { email: inv.email, role: inv.role, organisationName: organisationNameOf(inv) };
}
```

- [ ] **Step 4: Stop the real dep from reading a null company id**

In `functions/src/registration/index.ts`, replace the whole `findInvitationByHash` entry in `realDeps()`:

```ts
    findInvitationByHash: async (hash) => {
      const snap = await db().collection("invitations").where("tokenHash", "==", hash).limit(1).get();
      if (snap.empty) return null;
      const doc = snap.docs[0];
      const d = doc.data();
      // A back-office invitation has no company — skip the lookup entirely
      // rather than issuing a `doc(null)` read.
      const companyId = (d.companyId as string | null) ?? null;
      return {
        id: doc.id, email: d.email, role: d.role, companyId, tokenHash: d.tokenHash,
        companyName: companyId
          ? ((await db().collection("companies").doc(companyId).get()).data()?.name as string) ?? ""
          : null,
        expiresAt: d.expiresAt.toMillis(),
      } satisfies StoredInvitation;
    },
```

- [ ] **Step 5: Widen the client's callable wrapper**

In `src/lib/data/registration.ts`, add the type import at the top (after the existing `import { call } from "./callable";`):

```ts
import type { UserRole } from "@/lib/firestore/schema";
```

and replace `callResolveInvite`:

```ts
export const callResolveInvite = (code: string) =>
  call<{ code: string }, { email: string; role: UserRole; organisationName: string }>(
    "resolveInvite",
    { code },
  );
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest functions/src/registration/core.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add functions/src/registration/core.ts functions/src/registration/core.test.ts functions/src/registration/index.ts src/lib/data/registration.ts
git commit -m "feat: resolveInvite returns the invitee's role and organisation"
```

---

### Task 3: `acceptInvite` creates a back-office member

**Files:**
- Modify: `functions/src/registration/core.ts` (`profileDoc`, `registerCompanyCore`, `acceptInviteCore`)
- Test: `functions/src/registration/core.test.ts`

**Interfaces:**
- Consumes: `InviteRole` and the updated `StoredInvitation` from Task 1.
- Produces: nothing new for later tasks — `acceptInviteCore` keeps its signature.

- [ ] **Step 1: Write the failing test**

Append to `functions/src/registration/core.test.ts`:

```ts
test("acceptInvite on a back-office invitation creates an active, non-admin team member", async () => {
  const inv = {
    id: "inv2", email: "team@bike-eco.fr", role: "backoffice" as const, companyId: null,
    companyName: null, tokenHash: hashInviteCode("Z9Y8X7"), expiresAt: 2_000_000,
  };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await acceptInviteCore(
    { method: "password", code: "Z9Y8X7", nom: "N", prenom: "P", telephone: "0600000000", password: "password123" },
    null, null, d,
  );
  expect(d.calls.users["uid_new"]).toMatchObject({
    role: "backoffice", companyId: null, status: "active", isAdmin: false,
    nom: "N", prenom: "P", email: "team@bike-eco.fr", telephone: "0600000000",
  });
  expect(d.calls.claims).toEqual({
    uid: "uid_new", claims: { role: "backoffice", companyId: null, status: "active" },
  });
  expect(d.calls.invitations["inv2"]).toBe("deleted");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest functions/src/registration/core.test.ts -t "back-office invitation creates"`
Expected: FAIL — the created user has `role: "b2b"` and the claims are `{ role: "b2b", companyId: null, status: "active" }`.

- [ ] **Step 3: Implement**

In `functions/src/registration/core.ts`, replace `profileDoc` so the role and company come from the caller:

```ts
function profileDoc(
  input: { nom: string; prenom: string; telephone: string },
  email: string,
  role: InviteRole,
  companyId: string | null,
  status: "pending" | "active",
  isAdmin: boolean,
) {
  return {
    role, companyId, isAdmin,
    nom: input.nom, prenom: input.prenom, email,
    telephone: input.telephone,
    status,
  };
}
```

In `registerCompanyCore`, update its single call site:

```ts
  await deps.writeUser(uid, profileDoc(input, email, "b2b", companyId, "pending", true));
```

In `acceptInviteCore`, replace the two lines that write the user and the claims:

```ts
  await deps.writeUser(uid, profileDoc(input, inv.email, inv.role, inv.companyId, "active", false));
  await deps.setClaims(uid, { role: inv.role, companyId: inv.companyId, status: "active" });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest functions/src/registration/core.test.ts`
Expected: PASS — including the pre-existing b2b `acceptInvite` tests, which still assert `role: "b2b"` and `companyId: "comp_1"`.

- [ ] **Step 5: Run the full gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all three green. This is the first point in the plan where the whole tree type-checks again.

- [ ] **Step 6: Commit**

```bash
git add functions/src/registration/core.ts functions/src/registration/core.test.ts
git commit -m "feat: acceptInvite creates a back-office member for a back-office invitation"
```

---

### Task 4: The invitee funnel carries the role to the right dashboard

**Files:**
- Modify: `src/app/(auth)/invite-code.tsx`
- Modify: `src/app/(auth)/register-invited.tsx`
- Modify: `docs/specs/form-b2b-invited-registration.md`

**Interfaces:**
- Consumes: `callResolveInvite(code) → { email, role, organisationName }` from Task 2.
- Produces: the `/(auth)/register-invited` route now accepts four params — `code`, `email`, `role`, `organisationName`.

- [ ] **Step 1: Forward the role and organisation from the code screen**

In `src/app/(auth)/invite-code.tsx`, replace the body of the `resolving` action's async function:

```ts
    async (code: string) => {
      const { email, role, organisationName } = await callResolveInvite(code);
      router.push({
        pathname: "/(auth)/register-invited",
        params: { code, email, role, organisationName },
      });
    },
```

and replace the `subtitle` prop on `FormLayout` — the screen renders before the code is resolved, so it cannot name the organisation:

```tsx
          subtitle="Saisissez le code à 6 caractères reçu par email pour rejoindre votre équipe."
```

- [ ] **Step 2: Read the new params in the invited funnel**

In `src/app/(auth)/register-invited.tsx`, replace the `useLocalSearchParams` call:

```ts
  const { email, code, role, organisationName } = useLocalSearchParams<{
    email?: string;
    code?: string;
    role?: string;
    organisationName?: string;
  }>();
```

- [ ] **Step 3: Route to the dashboard that matches the role**

In the same file, in the `goingToDashboard` action, replace the `router.replace("/(b2b)/(tabs)/dashboard");` line:

```ts
      router.replace(
        role === "backoffice"
          ? "/(backoffice)/(tabs)/dashboard"
          : "/(b2b)/(tabs)/dashboard",
      );
```

- [ ] **Step 4: Name the organisation on step 1**

In the same file, on the `FormLayout` inside the `GoogleAuthProvider`, replace `subtitle={meta.subtitle}`:

```tsx
            subtitle={
              step === 0 && organisationName
                ? `Vous rejoignez ${organisationName}.`
                : meta.subtitle
            }
```

- [ ] **Step 5: Update the form spec**

In `docs/specs/form-b2b-invited-registration.md`:

Replace the sentence under the "Code d'invitation" screen that reads "Le code est un code à usage unique valable 1 heure, envoyé par email lors de l'invitation (voir page-add-colleague)." with:

```markdown
Le code est un code à usage unique valable 1 heure, envoyé par email lors de
l'invitation (voir page-add-colleague). Une invitation porte le rôle qu'elle
accorde : un invité rejoint soit une entreprise (b2b), soit l'équipe Bike-eco
(back-office). L'écran de saisie du code est antérieur à sa résolution, donc son
sous-titre reste neutre : "Saisissez le code à 6 caractères reçu par email pour
rejoindre votre équipe."
```

Under "Form : step 1", replace the `subtitle` line with:

```markdown
subtitle : "Vous rejoignez [nom de l'entreprise ou Bike-eco]." — le nom vient de la
résolution du code ; à défaut, "Informations relative à votre compte utilisateur"
```

At the end of the file, replace the step 3 destination lines:

```markdown
Button primary : "Aller à l'accueil"
Linkto : B2B Dashboard pour un invité b2b, Back-office Dashboard pour un invité
back-office (selon le rôle porté par l'invitation).
```

Add, just under the step 3 heading block:

```markdown
Un invité back-office suit exactement le même parcours (compte, coordonnées,
confirmation) et son compte est actif immédiatement — il n'y a pas d'étape de
validation, comme pour un invité b2b. Il n'est pas administrateur.
```

- [ ] **Step 6: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all three green. No new route file was added in this task, so no typed-route regeneration is needed.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(auth)/invite-code.tsx" "src/app/(auth)/register-invited.tsx" docs/specs/form-b2b-invited-registration.md
git commit -m "feat: invited funnel routes by role and names the organisation"
```

---

### Task 5: Back-office "Inviter un collègue" route

**Files:**
- Create: `src/components/screens/AddColleagueScreen.tsx`
- Create: `src/app/(backoffice)/add-colleague.tsx`
- Create: `src/app/(backoffice)/invite-sent.tsx`
- Modify: `src/app/(b2b)/add-colleague.tsx`
- Modify: `src/app/(backoffice)/(tabs)/settings.tsx`
- Modify: `docs/specs/page-add-colleague.md`

**Interfaces:**
- Consumes: `useInvite` (`src/lib/data/useInvite.ts`, unchanged — the server derives the role from the caller), `AddColleagueForm`, `ConfirmationView`.
- Produces: `AddColleagueScreen` (props: `{ onSent: () => void }`), and the routes `/(backoffice)/add-colleague` and `/(backoffice)/invite-sent`.

The page is identical for both roles — only the confirmation destination differs — so it follows this repo's established shape: a shared screen component under `src/components/screens/`, plus a thin route file per role that supplies the callback. This is exactly how `ColleaguesScreen` is used by `(b2b)/colleagues/index.tsx` and `(backoffice)/colleagues/index.tsx`.

- [ ] **Step 1: Extract the shared screen**

Create `src/components/screens/AddColleagueScreen.tsx`, moving the body of the existing b2b route into it. The header title is identical for both roles, so it lives here:

```tsx
import AddColleagueForm from "@/components/form/AddColleagueForm";
import { useInvite } from "@/lib/data/useInvite";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { alertDialog } from "@/lib/ui/dialog";
import { tokens } from "@/theme/tokens";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";

interface Props {
  /** The invitation is on its way — go to the caller's confirmation screen. */
  onSent: () => void;
}

/** "Inviter un collègue", shared by both roles: `sendInvite` derives the
 *  invitation's role from the caller, so only the destination differs. */
export default function AddColleagueScreen({ onSent }: Props) {
  const { invite, pending } = useInvite({
    onError: (message) => alertDialog("Invitation impossible", message),
  });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={headerOptions({
          title: "Inviter un collègue",
        })}
      />
      <AddColleagueForm
        busy={pending}
        onSubmit={async (email) => {
          // `invite` resolves to undefined on failure, having already alerted.
          if (await invite(email)) onSent();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
```

- [ ] **Step 2: Make the b2b route a thin wrapper**

Replace `src/app/(b2b)/add-colleague.tsx` entirely — its behaviour is unchanged:

```tsx
import AddColleagueScreen from "@/components/screens/AddColleagueScreen";
import { useRouter } from "expo-router";

export default function B2bAddColleague() {
  const router = useRouter();
  return (
    <AddColleagueScreen onSent={() => router.replace("/(b2b)/confirmation")} />
  );
}
```

- [ ] **Step 3: Create the back-office route**

Create `src/app/(backoffice)/add-colleague.tsx`:

```tsx
import AddColleagueScreen from "@/components/screens/AddColleagueScreen";
import { useRouter } from "expo-router";

export default function BackofficeAddColleague() {
  const router = useRouter();
  return (
    <AddColleagueScreen
      onSent={() => router.replace("/(backoffice)/invite-sent")}
    />
  );
}
```

- [ ] **Step 4: Create the invitation-sent confirmation route**

Create `src/app/(backoffice)/invite-sent.tsx`. It is a separate route because the existing `(backoffice)/confirmation.tsx` is hard-coded to dossier wording:

```tsx
import { Stack } from "expo-router";
import ConfirmationView from "@/components/ui/ConfirmationView";

export default function BackofficeInviteSent() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmationView
        title="C'est envoyé !"
        message="L'invitation a bien été envoyée."
        delay={1500}
        redirectTo="/(backoffice)/(tabs)/dashboard"
      />
    </>
  );
}
```

- [ ] **Step 5: Point the back-office Paramètres button at the new route**

Replace `src/app/(backoffice)/(tabs)/settings.tsx` entirely — the `alertDialog` stub and its import go away:

```tsx
import SettingsScreen from "@/components/screens/SettingsScreen";
import { useRouter } from "expo-router";

export default function BackofficeSettings() {
  const router = useRouter();
  return (
    <SettingsScreen
      role="backoffice"
      onManageCompanies={() => router.push("/(backoffice)/companies")}
      onInvite={() => router.push("/(backoffice)/add-colleague")}
      onManageColleagues={() => router.push("/(backoffice)/colleagues")}
    />
  );
}
```

- [ ] **Step 6: Regenerate typed routes**

Two route files were added, so `tsc` cannot resolve their `href` until `.expo/types/router.d.ts` is regenerated — bare `tsc` does not do it:

```bash
rm -f .expo/types/router.d.ts
( npx expo start > /tmp/expo-typegen.log 2>&1 & )
for i in $(seq 1 30); do [ -f .expo/types/router.d.ts ] && echo "TYPES REGENERATED" && break; sleep 1; done
pkill -f "expo start"; pkill -f "expo/cli"; sleep 1
```

Expected: `TYPES REGENERATED` is printed.

- [ ] **Step 7: Update the page spec**

In `docs/specs/page-add-colleague.md`, replace the "## Main section" intro block's button bullet list item for the confirmation link, and add a note at the top of "## Main section":

```markdown
Cette page sert les deux rôles. Un b2b invite un collaborateur de son entreprise ;
un back-office invite un membre de l'équipe Bike-eco. Elle n'est atteignable que
par un administrateur (le bouton "Inviter" de page-settings est masqué pour les
autres) et le serveur refuse l'appel d'un non-administrateur.
```

and replace the "link to page-confirmation" sub-bullet block with:

```markdown
  - link to page-confirmation
    - message : l'invitation à bien été envoyée.
    - Redirect to page-Dashboard (celui du rôle : b2b ou back-office)
```

- [ ] **Step 8: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all three green.

- [ ] **Step 9: Commit**

```bash
git add src/components/screens/AddColleagueScreen.tsx "src/app/(b2b)/add-colleague.tsx" "src/app/(backoffice)/add-colleague.tsx" "src/app/(backoffice)/invite-sent.tsx" "src/app/(backoffice)/(tabs)/settings.tsx" docs/specs/page-add-colleague.md
git commit -m "feat: back-office invite-a-colleague route"
```

---

### Task 6: Hide the invite section from non-admins

**Files:**
- Modify: `src/components/screens/SettingsScreen.tsx`
- Modify: `src/components/form/SettingsList.tsx`
- Modify: `docs/specs/page-settings.md`
- Modify: `docs/ops/first-backoffice-account.md`

**Interfaces:**
- Consumes: `useAccount()` → `{ data: SessionUser | null }` (`SessionUser` carries `id` and `isAdmin`), `useUser(uid)` → `{ data, loading, error }`.
- Produces: `SettingsList` gains a required `canInvite: boolean` prop.

- [ ] **Step 1: Compute the viewer's live admin flag in `SettingsScreen`**

Replace `src/components/screens/SettingsScreen.tsx` entirely:

```tsx
import SettingsList from "@/components/form/SettingsList";
import { useAccount } from "@/lib/data/useAccount";
import { useUser } from "@/lib/data/useUser";
import type { UserRole } from "@/lib/firestore/schema";
import { ScrollView } from "react-native";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onManageCompanies?: () => void;
  onManageColleagues: () => void;
}

export default function SettingsScreen({
  role,
  onInvite,
  onManageCompanies,
  onManageColleagues,
}: Props) {
  const { data: session } = useAccount();
  // Live rather than the AuthProvider snapshot taken at sign-in, so a
  // promotion/demotion reaches this gate without an app restart. Falls back
  // to the session's value while the live read is loading, so nothing
  // flickers into a more-permissive state.
  const { data: viewer, loading: viewerLoading } = useUser(session?.id ?? "");
  const canInvite = viewerLoading
    ? session?.isAdmin === true
    : viewer?.isAdmin === true;

  return (
    <ScrollView>
      <SettingsList
        role={role}
        canInvite={canInvite}
        onInvite={onInvite}
        onManageCompanies={onManageCompanies}
        onManageColleagues={onManageColleagues}
      />
    </ScrollView>
  );
}
```

- [ ] **Step 2: Gate and re-title the invite section**

In `src/components/form/SettingsList.tsx`, add `canInvite: boolean;` to `Props`, destructure it in the component signature, and replace the invite `Section` block:

```tsx
      {canInvite ? (
        <Section
          title={
            role === "backoffice"
              ? "Inviter un membre de l'équipe Bike-eco"
              : "Inviter un collaborateur de mon entreprise"
          }
        >
          <Button variant="outlined" label="Inviter" onPress={onInvite} />
        </Section>
      ) : null}
```

- [ ] **Step 3: Update the settings spec**

In `docs/specs/page-settings.md`, replace the B2B invite bullet:

```markdown
- Section "Inviter un collaborateur de mon entreprise" (**administrateurs uniquement** —
  la section est masquée pour les autres) :
  - Button secondary : "Inviter" (link to page-add-colleague)
```

and the Bike-eco Backoffice invite bullet:

```markdown
- Section "Inviter un membre de l'équipe Bike-eco" (**administrateurs uniquement** —
  la section est masquée pour les autres) :
  - Button secondary : "Inviter" (link to page-add-colleague)
```

- [ ] **Step 4: Note the new path in the ops runbook**

In `docs/ops/first-backoffice-account.md`, append at the end of the file:

```markdown
## Comptes back-office suivants

Ce script ne sert qu'au **premier** compte back-office. Une fois qu'il existe et
qu'il est administrateur, les membres suivants s'invitent depuis l'application :
Paramètres → "Inviter un membre de l'équipe Bike-eco". L'invité reçoit un code à
usage unique valable 1 heure, suit le parcours d'inscription invité, et obtient un
compte back-office **actif** et **non administrateur** — à promouvoir ensuite depuis
la page Collaborateur si besoin.
```

- [ ] **Step 5: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all three green.

- [ ] **Step 6: Manual verification on a device or emulator**

The house convention gates UI with `tsc` + lint rather than render tests, so this is the only check of the wiring:

1. Sign in as the back-office admin, open Paramètres → the section reads "Inviter un membre de l'équipe Bike-eco".
2. Invite an address you can read, confirm the "C'est envoyé !" screen and the redirect to the back-office dashboard.
3. Check the email names Bike-eco and carries a 6-character code.
4. Sign out, "J'ai un code d'invitation", enter the code → step 1 subtitle reads "Vous rejoignez Bike-eco.".
5. Finish the funnel; "Aller à l'accueil" lands on the **back-office** dashboard.
6. In Paramètres as that new (non-admin) member, the invite section is absent; "Mes collaborateurs" lists the team without a "Gérer" button.

- [ ] **Step 7: Commit**

```bash
git add src/components/screens/SettingsScreen.tsx src/components/form/SettingsList.tsx docs/specs/page-settings.md docs/ops/first-backoffice-account.md
git commit -m "feat: only admins see the invite section in Paramètres"
```

---

## Notes for the implementer

- **No `firestore.rules` change and no new index.** `invitations` is already `read, write: if false`; the callables read it with the Admin SDK. Do not add rules tests.
- **`deleteCompanyCore`'s `deleteInvitations(companyId)` sweep is deliberately untouched** — a back-office invitation has `companyId: null` and can never match a company id.
- **Not in scope:** listing or revoking pending invitations, inviting someone directly as an admin (promotion happens afterwards via `setColleagueAdmin` on the Collaborateur page), and any change to the b2b company-registration funnel.
- **Deploying the functions** is a separate step from this plan and is the owner's call.
