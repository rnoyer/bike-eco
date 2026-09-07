# Sign in with Apple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Sign in with Apple at full parity with the existing Google sign-in — the sign-in screen, the B2B company registration funnel and the invited team-member funnel — on iOS and web.

**Architecture:** A provider module per platform (`appleSignIn.ios.ts` / `.web.ts` / `.ts`) exporting the same signature as `signInWithGoogle`, so every call site treats the two providers uniformly. The Google-specific shared plumbing (email matching, the registration context, the `method` union, the French copy) is generalised to a provider-agnostic form rather than duplicated. Both registration callables gain a third member in their `method` discriminated union; their branching logic is already provider-shaped and does not change.

**Tech Stack:** Expo SDK 57, `expo-apple-authentication`, `expo-crypto`, Firebase JS SDK v12 (`OAuthProvider("apple.com")`), Zod v4, React Hook Form, Cloud Functions v2.

**Spec:** `docs/superpowers/specs/2026-09-07-apple-sign-in-design.md`

## Global Constraints

- **The gate**, green before any task is considered done: `npx tsc --noEmit && npx expo lint && npm test`. Functions tests are separate: `cd functions && npm test`. See `docs/tech/verification.md`.
- **Never let a credential reach Firebase Auth until the checks pass.** A refused identity that got as far as `signInWithCredential` leaves an Auth record with no profile, no claims and no password — unreachable and impossible to clean up client-side.
- **Nonce direction:** Apple receives the **SHA-256 hex digest**; Firebase receives the **raw, unhashed** nonce. Reversed, it fails with `auth/missing-or-invalid-nonce`.
- **All user-facing copy is French.** Reuse the existing typographic apostrophe `’` (U+2019) where the surrounding copy uses it.
- **`authErrors.ts` contract:** Firebase `auth/*` errors carry a `code` and an English message; errors this app raises itself are already French and carry **no** `code`. That is exactly how `frenchAuthMessage` tells them apart. An error thrown by a provider module must be a bare `Error` with a French message and no `code`.
- **House test style** (`docs/tech/verification.md`): pure logic is unit-tested; screens and components are gated by `tsc` + lint only. **Never add render tests.** Client tests import jest globals explicitly (`import { expect, test } from "@jest/globals";`); the `functions/` project uses bare globals — follow whichever project you are in.
- **Install with `npx expo install`**, never bare `npm install`.
- **Platform split:** `.ios.ts` for iOS, `.web.ts` for web, plain `.ts` for Android. All variants must export identical signatures or a platform breaks silently.
- Android renders no Apple button; the plain `.ts` module reports unavailable.
- One commit per task.

---

### Task 1: Provider-agnostic email matching

Generalise `googleEmail.ts` so Apple reuses `emailsMatch` and the mismatch error instead of duplicating them. Also the single home for the `AuthProviderId` vocabulary used by every later task.

**Files:**
- Create: `src/lib/auth/providerEmail.ts` (replaces `src/lib/auth/googleEmail.ts`)
- Create: `src/lib/auth/providerEmail.test.ts` (replaces `src/lib/auth/googleEmail.test.ts`)
- Delete: `src/lib/auth/googleEmail.ts`, `src/lib/auth/googleEmail.test.ts`
- Modify: `src/lib/auth/googleSignIn.ts` (import + `GoogleEmailMismatchError` call site)
- Modify: `src/lib/auth/googleSignIn.web.ts` (same)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type AuthProviderId = "google" | "apple"`
  - `const PROVIDER_LABELS: Record<AuthProviderId, string>` → `{ google: "Google", apple: "Apple" }`
  - `function emailsMatch(a: string | null | undefined, b: string | null | undefined): boolean`
  - `function providerEmailMismatchMessage(provider: AuthProviderId, providerEmail: string | null | undefined, expectedEmail: string): string`
  - `class ProviderEmailMismatchError extends Error` with `readonly provider: AuthProviderId`, `readonly providerEmail: string | null`, `readonly expectedEmail: string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/providerEmail.test.ts`:

```ts
import { expect, test } from "@jest/globals";
import {
  emailsMatch,
  ProviderEmailMismatchError,
  providerEmailMismatchMessage,
} from "./providerEmail";

test("matching ignores case and surrounding whitespace", () => {
  expect(emailsMatch("Rom.Noy@Gmail.com", "rom.noy@gmail.com")).toBe(true);
  expect(emailsMatch("  rom.noy@gmail.com  ", "rom.noy@gmail.com")).toBe(true);
});

test("different addresses do not match", () => {
  expect(emailsMatch("rno.dev@gmail.com", "rom.noy@gmail.com")).toBe(false);
});

test("a nullish or empty side never matches", () => {
  expect(emailsMatch(null, "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch(undefined, "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch("", "rom.noy@gmail.com")).toBe(false);
  expect(emailsMatch("rom.noy@gmail.com", null)).toBe(false);
  expect(emailsMatch(null, null)).toBe(false);
});

test("the message names both addresses so the user can pick the right account", () => {
  const msg = providerEmailMismatchMessage(
    "google",
    "rno.dev@gmail.com",
    "rom.noy@gmail.com",
  );
  expect(msg).toContain("rno.dev@gmail.com");
  expect(msg).toContain("rom.noy@gmail.com");
});

test("the message names the provider that was used", () => {
  expect(
    providerEmailMismatchMessage("google", "a@x.fr", "b@x.fr"),
  ).toContain("Le compte Google a@x.fr");
  expect(
    providerEmailMismatchMessage("apple", "a@x.fr", "b@x.fr"),
  ).toContain("Le compte Apple a@x.fr");
});

test("the message stays readable when the provider reports no email", () => {
  expect(providerEmailMismatchMessage("google", null, "rom.noy@gmail.com")).toContain(
    "Le compte Google sélectionné",
  );
  expect(providerEmailMismatchMessage("apple", null, "rom.noy@gmail.com")).toContain(
    "Le compte Apple sélectionné",
  );
});

test("the error carries the provider, both addresses and the French message", () => {
  const err = new ProviderEmailMismatchError(
    "apple",
    "rno.dev@gmail.com",
    "rom.noy@gmail.com",
  );
  expect(err).toBeInstanceOf(Error);
  expect(err.provider).toBe("apple");
  expect(err.providerEmail).toBe("rno.dev@gmail.com");
  expect(err.expectedEmail).toBe("rom.noy@gmail.com");
  expect(err.message).toBe(
    providerEmailMismatchMessage("apple", "rno.dev@gmail.com", "rom.noy@gmail.com"),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/auth/providerEmail.test.ts`
Expected: FAIL — `Cannot find module './providerEmail'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/auth/providerEmail.ts`:

```ts
/**
 * Email matching for the third-party sign-in paths, shared by every provider
 * and by both platform variants of each (hence no platform suffix — and
 * unit-testable without any native module).
 *
 * The invited-registration funnel locks the email to the invitation's address:
 * the provider account the user picks must be that same address. Mirrors the
 * server-side rule in `acceptInviteCore`, which stays as defence in depth.
 */

/** The third-party providers the app can sign in with. */
export type AuthProviderId = "google" | "apple";

/** How each provider is named in user-facing French copy. */
export const PROVIDER_LABELS: Record<AuthProviderId, string> = {
  google: "Google",
  apple: "Apple",
};

/** Case- and whitespace-insensitive comparison; nullish never matches. */
export function emailsMatch(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Names both addresses so the user knows which account to pick on retry. */
export function providerEmailMismatchMessage(
  provider: AuthProviderId,
  providerEmail: string | null | undefined,
  expectedEmail: string,
): string {
  const label = PROVIDER_LABELS[provider];
  const picked = providerEmail?.trim()
    ? `Le compte ${label} ${providerEmail.trim()}`
    : `Le compte ${label} sélectionné`;
  return `${picked} ne correspond pas à l'invitation envoyée à ${expectedEmail}. Reprenez avec le bon compte ${label}.`;
}

/** Thrown before the credential reaches Firebase Auth where the provider tells
 *  us the address up front, and to undo the sign-in where it does not. */
export class ProviderEmailMismatchError extends Error {
  readonly provider: AuthProviderId;
  readonly providerEmail: string | null;
  readonly expectedEmail: string;

  constructor(
    provider: AuthProviderId,
    providerEmail: string | null | undefined,
    expectedEmail: string,
  ) {
    super(providerEmailMismatchMessage(provider, providerEmail, expectedEmail));
    this.name = "ProviderEmailMismatchError";
    this.provider = provider;
    this.providerEmail = providerEmail ?? null;
    this.expectedEmail = expectedEmail;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/lib/auth/providerEmail.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Update the two Google call sites and delete the old files**

In `src/lib/auth/googleSignIn.ts`, replace the import

```ts
import { emailsMatch, GoogleEmailMismatchError } from "./googleEmail";
```

with

```ts
import { emailsMatch, ProviderEmailMismatchError } from "./providerEmail";
```

and the throw

```ts
    throw new GoogleEmailMismatchError(user.email, opts.expectedEmail);
```

with

```ts
    throw new ProviderEmailMismatchError("google", user.email, opts.expectedEmail);
```

In `src/lib/auth/googleSignIn.web.ts`, replace the same import, and replace

```ts
    throw new GoogleEmailMismatchError(result.user.email, opts.expectedEmail);
```

with

```ts
    throw new ProviderEmailMismatchError(
      "google",
      result.user.email,
      opts.expectedEmail,
    );
```

Then delete the superseded files:

```bash
git rm src/lib/auth/googleEmail.ts src/lib/auth/googleEmail.test.ts
```

- [ ] **Step 6: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green. If `tsc` reports a remaining `googleEmail` import, fix that call site — no other file should reference it.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/auth
git commit -m "refactor: make provider email matching provider-agnostic

googleEmail.ts becomes providerEmail.ts: emailsMatch is unchanged and stays
shared, the mismatch error and message take the provider so Apple can reuse
them instead of duplicating ~40 lines. Also the single home for AuthProviderId.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011PzhqdqB5zaYu9SDmoTHn2"
```

---

### Task 2: Apple ID token email decoder

Apple omits `email` from the credential on repeat authorizations. The identity token often still carries the claim, and reading it keeps the "check before `signInWithCredential`" invariant alive in the common case. Pure, no native imports, unit-tested.

**Files:**
- Create: `src/lib/auth/appleIdToken.ts`
- Create: `src/lib/auth/appleIdToken.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `function appleIdTokenEmail(idToken: string | null | undefined): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/auth/appleIdToken.test.ts`:

```ts
import { expect, test } from "@jest/globals";
import { appleIdTokenEmail } from "./appleIdToken";

/** Build a JWT-shaped string whose payload is `claims`. Only the payload is
 *  read, so the header and signature are deliberately meaningless. */
function tokenWith(claims: Record<string, unknown>): string {
  const payload = Buffer.from(JSON.stringify(claims), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

test("reads the email claim out of the payload", () => {
  expect(
    appleIdTokenEmail(tokenWith({ sub: "0001", email: "pro@garage.fr" })),
  ).toBe("pro@garage.fr");
});

test("reads a private-relay address like any other", () => {
  expect(
    appleIdTokenEmail(tokenWith({ email: "abc123@privaterelay.appleid.com" })),
  ).toBe("abc123@privaterelay.appleid.com");
});

test("a payload without an email claim yields null", () => {
  expect(appleIdTokenEmail(tokenWith({ sub: "0001" }))).toBeNull();
});

test("a non-string or empty email claim yields null", () => {
  expect(appleIdTokenEmail(tokenWith({ email: 42 }))).toBeNull();
  expect(appleIdTokenEmail(tokenWith({ email: "" }))).toBeNull();
});

test("a malformed or absent token yields null rather than throwing", () => {
  expect(appleIdTokenEmail(null)).toBeNull();
  expect(appleIdTokenEmail(undefined)).toBeNull();
  expect(appleIdTokenEmail("")).toBeNull();
  expect(appleIdTokenEmail("not-a-jwt")).toBeNull();
  expect(appleIdTokenEmail("header..signature")).toBeNull();
  expect(appleIdTokenEmail("header.%%%not-base64%%%.signature")).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/auth/appleIdToken.test.ts`
Expected: FAIL — `Cannot find module './appleIdToken'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/auth/appleIdToken.ts`:

```ts
/**
 * Reads the `email` claim out of an Apple identity token.
 *
 * Apple puts the user's email on `AppleAuthenticationCredential` only on the
 * *first* authorization for a given Apple ID; every later sign-in returns null
 * there. The identity token usually still carries the claim, and that is what
 * lets the invited-registration funnel compare the address *before* the
 * credential reaches Firebase — the invariant `googleSignIn.ts` documents.
 *
 * The signature is deliberately **not** verified, and does not need to be: the
 * value is only used to decide whether to abandon a sign-in early. A forged
 * token buys nothing — Firebase still verifies the credential itself, and
 * `acceptInviteCore` still re-checks the address server-side. Treat the result
 * as a hint, never as authorization.
 *
 * Returns null for anything unparseable, including a token whose claim is
 * simply absent — the caller falls back to reading the address off the signed-in
 * user (see `appleSignIn.ios.ts`).
 */
export function appleIdTokenEmail(
  idToken: string | null | undefined,
): string | null {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    // base64url → base64, then pad to a multiple of 4 for `atob`.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    // `atob` yields one character per byte; re-encode as percent escapes so a
    // non-ASCII claim (a name, say) survives as valid UTF-8.
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    const claims = JSON.parse(json) as { email?: unknown };
    return typeof claims.email === "string" && claims.email
      ? claims.email
      : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/lib/auth/appleIdToken.test.ts`
Expected: PASS, 5 tests.

If the `atob` call throws `ReferenceError` under jest, the environment lacks the global. Do **not** reach for a polyfill package — React Native 0.86 and Node 18+ both provide `atob`; a failure here means the test environment, so re-check `npm test` (which uses the `jest-expo` preset) rather than `npx jest` alone.

- [ ] **Step 5: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/appleIdToken.ts src/lib/auth/appleIdToken.test.ts
git commit -m "feat: read the email claim from an Apple identity token

Apple returns the email on the credential only on a first authorization, so
the invited funnel needs the token's claim to keep comparing the address
before the credential reaches Firebase. Unverified by design — a hint used
only to abandon a sign-in early, never as authorization.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011PzhqdqB5zaYu9SDmoTHn2"
```

---

### Task 3: Server — accept `method: "apple"` in both callables

The cores already branch on `method === "password"` with an else covering every provider, so only the schemas and the hardcoded French copy change.

**Files:**
- Modify: `functions/src/registration/schemas.ts:10-19` (both discriminated unions)
- Modify: `functions/src/registration/core.ts:77,162,164` (provider-aware copy)
- Modify: `functions/src/registration/schemas.test.ts` (add cases)
- Modify: `functions/src/registration/core.test.ts` (add cases)

**Interfaces:**
- Consumes: nothing.
- Produces: `RegisterCompanyInput["method"]` and `AcceptInviteInput["method"]` both widen to `"password" | "google" | "apple"`. Task 4 mirrors that union on the client.

- [ ] **Step 1: Write the failing tests**

Append to `functions/src/registration/schemas.test.ts`:

```ts
test("apple company registration does not require email/password", () => {
  const { email: _email, password: _password, ...rest } = base;
  expect(registerCompanySchema.safeParse({ ...rest, method: "apple" }).success).toBe(true);
});

test("apple company registration rejects a password", () => {
  const { email: _email, ...rest } = base;
  expect(registerCompanySchema.safeParse({ ...rest, method: "apple" }).success).toBe(false);
});

test("apple invited registration does not require a password", () => {
  const { password: _password, ...rest } = acceptBase;
  expect(acceptInviteSchema.safeParse({ ...rest, method: "apple" }).success).toBe(true);
});

test("an unknown method is rejected", () => {
  const { email: _email, password: _password, ...rest } = base;
  expect(registerCompanySchema.safeParse({ ...rest, method: "facebook" }).success).toBe(false);
});
```

Append to `functions/src/registration/core.test.ts`. These use the file's existing `fakeDeps` / `companyInput` helpers and its inline invitation-fixture style — do not introduce a second style:

```ts
test("registerCompany (apple) uses the authed uid + email, no createUser", async () => {
  const { email: _email, password: _password, ...rest } = companyInput;
  const d = fakeDeps({ createUser: async () => { throw new Error("must not be called"); } });
  await registerCompanyCore({ ...rest, method: "apple" }, "uid_a", "a@x.fr", d);
  expect(d.calls.users["uid_a"]).toMatchObject({ role: "b2b", status: "pending", email: "a@x.fr" });
});

test("apple mode with no auth names Apple, not Google, in the error", async () => {
  const { email: _email, password: _password, ...rest } = companyInput;
  await expect(
    registerCompanyCore({ ...rest, method: "apple" }, null, null, fakeDeps()),
  ).rejects.toMatchObject({
    code: "unauthenticated",
    message: "Connexion Apple requise.",
  });
});

test("acceptInvite (apple) names Apple in the mismatch error", async () => {
  const inv = { id: "inv1", email: "new@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "G", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  const d = fakeDeps({ findInvitationByHash: async () => inv });
  await expect(
    acceptInviteCore(
      { method: "apple", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000" },
      "uid_a",
      "other@x.fr",
      d,
    ),
  ).rejects.toMatchObject({
    code: "permission-denied",
    message: "Ce compte Apple ne correspond pas à l'invitation.",
  });
});

test("acceptInvite (apple) with a matching email creates an active user", async () => {
  const inv = { id: "inv1", email: "New@x.fr", role: "b2b" as const, companyId: "comp_1", companyName: "G", tokenHash: hashInviteCode("A1B2C3"), expiresAt: 2_000_000 };
  const d = fakeDeps({ findInvitationByHash: async () => inv, createUser: async () => { throw new Error("must not be called"); } });
  await acceptInviteCore({ method: "apple", code: "A1B2C3", nom: "N", prenom: "P", telephone: "0600000000" }, "uid_a", "new@x.fr", d);
  expect(d.calls.users["uid_a"]).toMatchObject({ role: "b2b", companyId: "comp_1", status: "active" });
  expect(d.calls.invitations["inv1"]).toBe("deleted");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd functions && npx jest registration`
Expected: FAIL — the schema rejects `method: "apple"`, and the copy still says "Google".

- [ ] **Step 3: Widen both discriminated unions**

In `functions/src/registration/schemas.ts`, replace lines 9-19 with:

```ts
// Company signup: password mode carries the new account's email + password. A
// third-party mode carries neither — the identity already exists in Auth and the
// callable reads it off the request's authentication.
const registerCredential = z.discriminatedUnion("method", [
  z.object({ method: z.literal("password"), email: z.email(), password: z.string().min(8) }),
  z.object({ method: z.literal("google") }),
  z.object({ method: z.literal("apple") }),
]);

// Invited signup: the email comes from the invitation, so password mode needs only a password.
const acceptCredential = z.discriminatedUnion("method", [
  z.object({ method: z.literal("password"), password: z.string().min(8) }),
  z.object({ method: z.literal("google") }),
  z.object({ method: z.literal("apple") }),
]);
```

One literal member per provider rather than a shared enum member: it keeps the shape legible, and a future provider that needs its own payload fields can be added without restructuring.

- [ ] **Step 4: Make the copy provider-aware**

In `functions/src/registration/core.ts`, add this helper just above `registerCompanyCore` (after the `profileDoc` function):

```ts
/** The provider's name in user-facing copy. Only reached in third-party mode:
 *  `input.method` has already been narrowed away from "password". */
function providerLabel(method: "google" | "apple"): string {
  return method === "apple" ? "Apple" : "Google";
}
```

In `registerCompanyCore`, replace

```ts
    if (!authUid || !authEmail) throw new RegError("unauthenticated", "Connexion Google requise.");
```

with

```ts
    if (!authUid || !authEmail) {
      throw new RegError("unauthenticated", `Connexion ${providerLabel(input.method)} requise.`);
    }
```

In `acceptInviteCore`, replace

```ts
    if (!authUid || !authEmail) throw new RegError("unauthenticated", "Connexion Google requise.");
    if (authEmail.toLowerCase() !== inv.email.toLowerCase()) {
      throw new RegError("permission-denied", "Ce compte Google ne correspond pas à l'invitation.");
    }
```

with

```ts
    const label = providerLabel(input.method);
    if (!authUid || !authEmail) {
      throw new RegError("unauthenticated", `Connexion ${label} requise.`);
    }
    if (authEmail.toLowerCase() !== inv.email.toLowerCase()) {
      throw new RegError("permission-denied", `Ce compte ${label} ne correspond pas à l'invitation.`);
    }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd functions && npm test`
Expected: PASS, including the pre-existing Google tests unchanged — their copy is identical because `providerLabel("google")` returns `"Google"`.

- [ ] **Step 6: Build the functions and run the app gate**

Run: `cd functions && npm run build && cd .. && npx tsc --noEmit && npx expo lint && npm test`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add functions/src/registration
git commit -m "feat(functions): accept method apple in both registration callables

A third literal member in each discriminated union; the cores already branch
password-vs-provider so only the hardcoded French copy changes, via a
providerLabel helper. Google's messages are byte-identical to before.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011PzhqdqB5zaYu9SDmoTHn2"
```

---

### Task 4: Client registration plumbing stops being Google-specific

Rename the registration context and widen the payload unions, still with Google as the only provider wired up. Nothing changes behaviourally; this is the seam Task 7 plugs Apple into.

**Files:**
- Create: `src/features/registration/providerAuth.tsx` (replaces `googleAuth.tsx`)
- Delete: `src/features/registration/googleAuth.tsx`
- Modify: `src/features/registration/fields.tsx` (import, reporter call, placeholder constant)
- Modify: `src/app/(auth)/register.tsx:16,27,36,40,103-109`
- Modify: `src/app/(auth)/register-invited.tsx:16,24-28,39,76-94,151-158`
- Modify: `src/lib/data/registration.ts:5,18`
- Modify: `src/features/b2b-invited-registration/submit.ts:14,19`

**Interfaces:**
- Consumes: `AuthProviderId` from Task 1 (`@/lib/auth/providerEmail`).
- Produces:
  - `interface ProviderProfile { prenom: string | null; nom: string | null; email: string | null }`
  - `const ProviderAuthProvider` — the context provider, value `{ onProviderProfile: (p: ProviderProfile, provider: AuthProviderId) => Promise<void> | void }`
  - `const useProviderAuthReporter: () => { onProviderProfile: (p: ProviderProfile, provider: AuthProviderId) => Promise<void> | void }`
  - `const PROVIDER_PASSWORD_PLACEHOLDER = "provider-auth-placeholder"`
  - `RegisterCompanyPayload["method"]` / `AcceptInvitePayload["method"]`: `"password" | "google" | "apple"`
  - `submitInvitedRegistration(values, method?: "password" | "google" | "apple")`

**Testing note:** this task adds no tests. Per `docs/tech/verification.md` screens and components are gated by `tsc` + lint only, and nothing here is pure logic. Do not add render tests.

- [ ] **Step 1: Create the provider-agnostic context**

Create `src/features/registration/providerAuth.tsx`:

```tsx
import { createContext, useContext } from "react";

import type { AuthProviderId } from "@/lib/auth/providerEmail";

export interface ProviderProfile {
  prenom: string | null;
  nom: string | null;
  email: string | null;
}

/** The password value seeded on the account step after a third-party sign-in.
 *  The step validator requires both password fields to be non-empty and equal,
 *  and the provider flows have no password to give it — this is never sent
 *  anywhere: `submitInvitedRegistration` omits the password in provider mode. */
export const PROVIDER_PASSWORD_PLACEHOLDER = "provider-auth-placeholder";

/** Lets the shared AccountFields report a successful third-party sign-in to the
 *  enclosing registration screen, so the screen (not ambient auth state) decides
 *  which provider the submission uses. Default is a no-op. */
const ProviderAuthContext = createContext<{
  onProviderProfile: (
    profile: ProviderProfile,
    provider: AuthProviderId,
  ) => Promise<void> | void;
}>({
  onProviderProfile: () => {},
});

export const ProviderAuthProvider = ProviderAuthContext.Provider;
export const useProviderAuthReporter = () => useContext(ProviderAuthContext);
```

Then: `git rm src/features/registration/googleAuth.tsx`

- [ ] **Step 2: Update `fields.tsx`**

In `src/features/registration/fields.tsx`, replace the import

```ts
import { useGoogleAuthReporter } from "./googleAuth";
```

with

```ts
import {
  PROVIDER_PASSWORD_PLACEHOLDER,
  useProviderAuthReporter,
} from "./providerAuth";
```

Replace `const { onGoogleProfile } = useGoogleAuthReporter();` with
`const { onProviderProfile } = useProviderAuthReporter();`.

Inside `googleSigningIn`, replace the two `setValue` placeholder lines

```ts
      form.setValue("password", "google-auth-placeholder");
      form.setValue("confirmPassword", "google-auth-placeholder");
      await onGoogleProfile(profile);
```

with

```ts
      form.setValue("password", PROVIDER_PASSWORD_PLACEHOLDER);
      form.setValue("confirmPassword", PROVIDER_PASSWORD_PLACEHOLDER);
      await onProviderProfile(profile, "google");
```

and update the comment above them so it reads "Provider flows use the authenticated identity from Auth" rather than "Google flow".

- [ ] **Step 3: Widen the payload unions**

In `src/lib/data/registration.ts`, change both `method` fields:

```ts
export interface RegisterCompanyPayload {
  method: "password" | "google" | "apple";
```

```ts
export interface AcceptInvitePayload {
  method: "password" | "google" | "apple";
```

In `src/features/b2b-invited-registration/submit.ts`, change the signature

```ts
  method: "password" | "google" = "password",
```

to

```ts
  method: "password" | "google" | "apple" = "password",
```

and update its doc comment: replace "in Google mode the identity already exists (step 1 signed in)" with "in provider mode (Google or Apple) the identity already exists (step 1 signed in)".

- [ ] **Step 4: Update `register.tsx`**

Replace the import

```ts
import { GoogleAuthProvider } from "@/features/registration/googleAuth";
```

with

```ts
import { ProviderAuthProvider } from "@/features/registration/providerAuth";
import type { AuthProviderId } from "@/lib/auth/providerEmail";
```

Replace `const usedGoogle = useRef(false);` with

```ts
  // Which third-party provider signed the applicant in on step 2, if any. The
  // screen decides the submission's mode from this, never from ambient auth.
  const usedProvider = useRef<AuthProviderId | null>(null);
```

In `onSubmit`, replace `if (usedGoogle.current) {` with `if (usedProvider.current) {`, replace the comment "Google mode: already signed in during step 2" with "Provider mode: already signed in during step 2", and replace `method: "google",` with `method: usedProvider.current,`.

Replace the JSX wrapper

```tsx
      <GoogleAuthProvider
        value={{
          onGoogleProfile: async () => {
            usedGoogle.current = true;
            await next();
          },
        }}
      >
```

with

```tsx
      <ProviderAuthProvider
        value={{
          onProviderProfile: async (_profile, provider) => {
            usedProvider.current = provider;
            await next();
          },
        }}
      >
```

and its closing `</GoogleAuthProvider>` with `</ProviderAuthProvider>`.

- [ ] **Step 5: Update `register-invited.tsx`**

Replace the import as in Step 4 (`ProviderAuthProvider` + the `AuthProviderId` type).

Replace the `CompletedInvite` type

```ts
type CompletedInvite = {
  method: "password" | "google";
  email: string;
  password: string;
};
```

with

```ts
type CompletedInvite = {
  method: "password" | "google" | "apple";
  email: string;
  password: string;
};
```

Replace `const usedGoogle = useRef(false);` with

```ts
  // Which third-party provider signed the invitee in on step 1, if any.
  const usedProvider = useRef<AuthProviderId | null>(null);
```

In `onSubmit`, replace the branch head `if (usedGoogle.current) {` with `if (usedProvider.current) {`, its comment "Google mode: already signed in during step 1" with "Provider mode: already signed in during step 1", and the two lines

```ts
            await submitInvitedRegistration({ ...values, code }, "google");
            completed.current = {
              method: "google",
```

with

```ts
            await submitInvitedRegistration({ ...values, code }, usedProvider.current);
            completed.current = {
              method: usedProvider.current,
```

In `goingToDashboard`, the `c?.method === "password"` check already covers every provider through its else branch — leave it, but update its comment from "(Google mode)" to "(provider mode)".

Replace the JSX wrapper exactly as in Step 4.

- [ ] **Step 6: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green. `tsc` is the real check here — it will name any file still importing `googleAuth` or reading `usedGoogle`.

- [ ] **Step 7: Verify no Google-specific plumbing names survive**

Run: `grep -rn "usedGoogle\|onGoogleProfile\|googleAuth\|google-auth-placeholder" src/`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add -A src/features/registration src/app src/lib/data/registration.ts src/features/b2b-invited-registration/submit.ts
git commit -m "refactor: make the registration provider plumbing provider-agnostic

googleAuth.tsx becomes providerAuth.tsx and reports which provider signed the
user in; the funnels track usedProvider instead of a usedGoogle boolean and
send that as the payload method. Renaming our GoogleAuthProvider export also
stops it shadowing Firebase's own. No behaviour change.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011PzhqdqB5zaYu9SDmoTHn2"
```

---

### Task 5: The Apple provider modules

The three platform variants, the two new dependencies and the iOS config. After this task Apple sign-in is callable but nothing calls it yet.

**Files:**
- Modify: `package.json` (via `npx expo install`)
- Modify: `app.json` (`ios.usesAppleSignIn`, plugins)
- Create: `src/lib/auth/appleSignIn.ios.ts`
- Create: `src/lib/auth/appleSignIn.web.ts`
- Create: `src/lib/auth/appleSignIn.ts`
- Modify: `src/lib/auth/authErrors.test.ts` (cancellation-contract case)

**Interfaces:**
- Consumes: `emailsMatch`, `ProviderEmailMismatchError` (Task 1); `appleIdTokenEmail` (Task 2).
- Produces, identically from all three files:
  - `function isAppleSignInAvailable(): Promise<boolean>`
  - `function signInWithApple(opts?: { expectedEmail?: string }): Promise<{ prenom: string | null; nom: string | null; email: string | null; isNewUser: boolean }>`

- [ ] **Step 1: Install the dependencies**

```bash
npx expo install expo-apple-authentication expo-crypto
```

Expected: both added to `package.json` at SDK-57-compatible versions. If `expo install` warns about a peer conflict, report it — do not pass `--force` or fall back to `npm install`.

- [ ] **Step 2: Configure iOS**

In `app.json`, add `usesAppleSignIn` to the `ios` block:

```json
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist",
      "usesAppleSignIn": true,
```

and add the plugin to the `plugins` array, next to the Google sign-in plugin:

```json
      "@react-native-google-signin/google-signin",
      "expo-apple-authentication",
```

- [ ] **Step 3: Write the iOS module**

Create `src/lib/auth/appleSignIn.ios.ts`:

```ts
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import {
  deleteUser,
  getAdditionalUserInfo,
  OAuthProvider,
  signInWithCredential,
  signOut,
} from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import { appleIdTokenEmail } from "./appleIdToken";
import { emailsMatch, ProviderEmailMismatchError } from "./providerEmail";

/** iOS 13+ on a device signed in to iCloud with 2FA. False everywhere else. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return AppleAuthentication.isAvailableAsync();
}

/**
 * The nonce, in both the forms this flow needs.
 *
 * Getting the two backwards is *the* Sign in with Apple bug, and it surfaces as
 * `auth/missing-or-invalid-nonce`: Apple receives the SHA-256 **digest**, and
 * Firebase receives the **raw** string, so that Firebase can hash it itself and
 * confirm the token it was handed answers this specific request.
 * `digestStringAsync` returns hex by default, which is the encoding Apple wants.
 */
async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Array.from(Crypto.getRandomBytes(32), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
  );
  return { raw, hashed };
}

export async function signInWithApple(opts?: {
  /** Invited registration: the Apple account used must be the invitation's address. */
  expectedEmail?: string;
}): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
  /** True when this sign-in created the Firebase Auth record, so a caller that
   *  rejects the identity can delete it instead of leaving a dormant account. */
  isNewUser: boolean;
}> {
  const { raw, hashed } = await makeNonce();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed, // Apple gets the digest.
    });
  } catch (e) {
    // Apple's cancellation carries `code: "ERR_REQUEST_CANCELED"` — a code that
    // is not an `auth/*` code, so `frenchAuthMessage` would fall through to the
    // generic "la connexion a échoué" for what is just a tap on Annuler.
    // Rethrow as a bare French Error with no `code`, which is the contract
    // `authErrors.ts` documents and `googleSignIn.ts` also honours.
    if ((e as { code?: string }).code === "ERR_REQUEST_CANCELED") {
      throw new Error("Connexion Apple annulée.");
    }
    throw e;
  }

  const { identityToken, fullName } = credential;
  if (!identityToken) {
    throw new Error("La connexion Apple a échoué. Veuillez réessayer.");
  }

  // Apple hands over the email only on the *first* authorization for this Apple
  // ID; later sign-ins return null and we fall back to the token's claim, which
  // is usually but not always present.
  const knownEmail = credential.email ?? appleIdTokenEmail(identityToken);

  // Tier 1 — the address is known before Firebase has seen anything, so a
  // mismatched account is never created. Creating it first would strand an Auth
  // user with no profile, no claims and no password: unreachable, and
  // impossible to clean up client-side.
  if (
    opts?.expectedEmail &&
    knownEmail &&
    !emailsMatch(knownEmail, opts.expectedEmail)
  ) {
    throw new ProviderEmailMismatchError("apple", knownEmail, opts.expectedEmail);
  }

  const cred = await signInWithCredential(
    auth,
    new OAuthProvider("apple.com").credential({
      idToken: identityToken,
      rawNonce: raw, // Firebase gets the raw string.
    }),
  );
  const isNewUser = getAdditionalUserInfo(cred)?.isNewUser ?? false;
  const email = knownEmail ?? cred.user.email;

  // Tier 2 — a repeat authorization that told us nothing. Firebase persisted the
  // address on the account at first sign-in, so compare that and undo, the same
  // way `googleSignIn.web.ts` undoes a popup it could not pre-empt. Only an
  // account this call just created may be deleted; a pre-existing one belongs to
  // a real user and is merely signed back out. A null address fails the match
  // and is refused too — an unverifiable identity must not pass.
  if (opts?.expectedEmail && !emailsMatch(email, opts.expectedEmail)) {
    if (isNewUser) await deleteUser(cred.user).catch(() => signOut(auth));
    else await signOut(auth);
    throw new ProviderEmailMismatchError("apple", email, opts.expectedEmail);
  }

  return {
    // Also first-authorization-only. An empty prefill just means the user types
    // their name on the "Vos coordonnées" step, as in the password flow.
    prenom: fullName?.givenName ?? null,
    nom: fullName?.familyName ?? null,
    email: email ?? null,
    isNewUser,
  };
}
```

- [ ] **Step 4: Write the web module**

Create `src/lib/auth/appleSignIn.web.ts`:

```ts
import {
  deleteUser,
  getAdditionalUserInfo,
  OAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import { emailsMatch, ProviderEmailMismatchError } from "./providerEmail";

/** The popup flow works in any browser; there is no device capability to probe. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return true;
}

export async function signInWithApple(opts?: {
  /** Invited registration: the Apple account used must be the invitation's address. */
  expectedEmail?: string;
}): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
  /** True when this sign-in created the Firebase Auth record, so a caller that
   *  rejects the identity can delete it instead of leaving a dormant account. */
  isNewUser: boolean;
}> {
  // No manual nonce here: unlike the native flow, `signInWithPopup` runs the
  // whole OAuth round-trip itself and manages its own nonce.
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  const result = await signInWithPopup(auth, provider);
  const isNewUser = getAdditionalUserInfo(result)?.isNewUser ?? false;
  // As with Google on web, the popup has already signed in by the time it
  // returns, so a mismatch has to be undone rather than prevented. Only an
  // account this popup just created may be deleted — a mismatched but
  // pre-existing account belongs to a real user and is merely signed back out.
  if (opts?.expectedEmail && !emailsMatch(result.user.email, opts.expectedEmail)) {
    if (isNewUser) await deleteUser(result.user);
    else await signOut(auth);
    throw new ProviderEmailMismatchError(
      "apple",
      result.user.email,
      opts.expectedEmail,
    );
  }
  // Apple gives web a single displayName, and only on a first sign-in; split
  // best-effort into prénom / nom exactly as the Google web variant does.
  const parts = (result.user.displayName ?? "").trim().split(/\s+/);
  return {
    prenom: parts[0] || null,
    nom: parts.length > 1 ? parts.slice(1).join(" ") : null,
    email: result.user.email ?? null,
    isNewUser,
  };
}
```

- [ ] **Step 5: Write the Android module**

Create `src/lib/auth/appleSignIn.ts`:

```ts
/**
 * Android. Metro resolves `.ios.ts` on iOS and `.web.ts` on web, so this plain
 * file is what Android gets — which is why Apple needs a three-file split where
 * Google needs only two: `expo-apple-authentication` is iOS-only, and Google's
 * native module is not. Nothing native may be imported here.
 *
 * Sign in with Apple on Android would need a browser round-trip against the
 * Apple Services ID; it is deliberately out of scope. No Apple button is
 * rendered on Android, so `signInWithApple` should be unreachable — it throws
 * rather than failing silently if that ever stops being true.
 */

export async function isAppleSignInAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithApple(_opts?: {
  expectedEmail?: string;
}): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
  isNewUser: boolean;
}> {
  throw new Error("La connexion Apple n’est pas disponible sur cet appareil.");
}
```

- [ ] **Step 6: Pin the cancellation contract with a test**

Append to `src/lib/auth/authErrors.test.ts`:

```ts
test("frenchAuthMessage keeps a provider cancellation message verbatim", () => {
  // Both provider modules rethrow a cancellation as a bare French Error with no
  // `code`, which is the only reason this copy survives instead of being
  // flattened to the generic fallback.
  expect(frenchAuthMessage(new Error("Connexion Apple annulée."))).toBe(
    "Connexion Apple annulée.",
  );
});

test("frenchAuthMessage would flatten a cancellation that kept Apple's code", () => {
  // Documents why the rethrow above is necessary: ERR_REQUEST_CANCELED is a
  // code, but not an `auth/*` code, so it takes the generic branch.
  expect(
    frenchAuthMessage(
      Object.assign(new Error("The user canceled the authorization attempt."), {
        code: "ERR_REQUEST_CANCELED",
      }),
    ),
  ).toBe("La connexion a échoué. Veuillez réessayer.");
});
```

- [ ] **Step 7: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green. `tsc` type-checks `appleSignIn.ts` (the Android variant) by default; if it reports a signature mismatch between the three files, reconcile them — divergence is exactly the failure this split risks.

- [ ] **Step 8: Verify the web build still typechecks against the web variant**

Run: `npx tsc --noEmit -p tsconfig.json` is already covered above; additionally confirm Metro resolves all three by checking the files exist with the exact names:

```bash
ls src/lib/auth/appleSignIn.ios.ts src/lib/auth/appleSignIn.web.ts src/lib/auth/appleSignIn.ts
```

Expected: all three listed. A typo in a platform suffix fails silently at runtime, not at build time.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json app.json src/lib/auth
git commit -m "feat: Apple sign-in provider modules for iOS, web and Android

Three platform variants behind one signature matching signInWithGoogle. iOS
uses the native sheet with a nonce whose digest goes to Apple and whose raw
form goes to Firebase; web uses signInWithPopup; Android reports unavailable
because expo-apple-authentication is iOS-only. The invited-funnel email check
is two-tier because Apple omits the email on repeat authorizations.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011PzhqdqB5zaYu9SDmoTHn2"
```

---

### Task 6: The Apple button, and Apple on the sign-in screen

The button components, plus extracting the sign-in screen's refuse-an-unregistered-identity rule so both providers share it instead of duplicating ~40 lines.

**Files:**
- Create: `src/components/ui/AppleAuthButton.ios.tsx`
- Create: `src/components/ui/AppleAuthButton.web.tsx`
- Create: `src/components/ui/AppleAuthButton.tsx`
- Modify: `src/components/ui/ThirdPartyAuthButtons.tsx`
- Create: `src/lib/auth/thirdPartySignIn.ts`
- Modify: `src/app/(auth)/signin.tsx:9,20,25,57-108,153-158`

**Interfaces:**
- Consumes: `signInWithApple` / `isAppleSignInAvailable` (Task 5); `signInWithGoogle` (existing); `AuthProviderId`, `PROVIDER_LABELS` (Task 1).
- Produces:
  - `function signInExistingAccount(provider: AuthProviderId): Promise<void>` — resolves when the identity has a `users/{uid}` profile and the session stands; throws an already-French `Error` otherwise, having cleaned up the Auth record.
  - `ThirdPartyAuthButtons`'s `onPress` narrows from `(provider: "google" | "apple" | "facebook") => void` to `(provider: AuthProviderId) => void`.

**Testing note:** no tests. `signInExistingAccount` reaches Firestore and Firebase Auth, so it is not pure logic; components are gated by `tsc` + lint. Do not add render tests.

- [ ] **Step 1: Write the iOS button**

Create `src/components/ui/AppleAuthButton.ios.tsx`:

```tsx
import { isAppleSignInAvailable } from "@/lib/auth/appleSignIn";
import { tokens } from "@/theme/tokens";
import * as AppleAuthentication from "expo-apple-authentication";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

/**
 * Apple's own button, not a custom one.
 *
 * The Human Interface Guidelines allow a custom button only with the official
 * logo, an approved title, approved colours and proportions — and "Apple" alone,
 * which is what the rest of this row uses for its providers, is *not* an
 * approved title. The system button is Apple-approved by construction, and it
 * localises itself ("Se connecter avec Apple") and handles accessibility.
 *
 * WHITE_OUTLINE with the app's own corner radius and button height puts it
 * visually alongside the outlined buttons around it. `backgroundColor` and
 * `borderRadius` must not be set through `style` — that is both ineffective and
 * against the guidelines; `buttonStyle` and `cornerRadius` are the way.
 */
export default function AppleAuthButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    // Through the provider module rather than `expo-apple-authentication`
    // directly, so the native module has exactly one importer.
    void isAppleSignInAvailable().then((ok) => {
      if (active) setAvailable(ok);
    });
    return () => {
      active = false;
    };
  }, []);

  // iOS 12 and below, or a device that cannot offer Apple sign-in at all: show
  // nothing rather than a button that can only fail.
  if (!available) return null;

  return (
    <View
      pointerEvents={disabled ? "none" : "auto"}
      style={disabled ? styles.disabled : undefined}
    >
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
        cornerRadius={tokens.radius.md}
        style={styles.button}
        onPress={onPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The native button draws nothing without an explicit width and height.
  button: { width: "100%", height: tokens.button.height },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 2: Write the web button**

Create `src/components/ui/AppleAuthButton.web.tsx`:

```tsx
import { tokens } from "@/theme/tokens";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

/**
 * Web has no native Apple button, so this is the custom one the Human Interface
 * Guidelines permit: Apple's official logo, an approved title, and the
 * white-with-outline treatment the rest of this row uses. The title must stay
 * one of Apple's approved strings — "Continuer avec Apple" or "Se connecter avec
 * Apple". "Apple" on its own is not approved.
 */
export default function AppleAuthButton({
  onPress,
  disabled = false,
}: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      disabled={disabled}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={require("@/assets/images/icons/appleIcon.svg")}
        style={styles.btnIcon}
        contentFit="contain"
      />
      <Text style={styles.btnText}>Continuer avec Apple</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  btnDisabled: { opacity: 0.5 },
  btnIcon: { width: 20, height: 20 },
  btnText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: tokens.colors.primary,
    textAlign: "center",
  },
});
```

- [ ] **Step 3: Write the Android button**

Create `src/components/ui/AppleAuthButton.tsx`:

```tsx
/**
 * Android. Metro resolves `.ios.tsx` on iOS and `.web.tsx` on web, so this plain
 * file is Android's — and Sign in with Apple is out of scope there (see
 * `appleSignIn.ts`). Rendering nothing is the whole behaviour; importing
 * `expo-apple-authentication` here would break the Android build.
 */
export default function AppleAuthButton(_props: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return null;
}
```

- [ ] **Step 4: Wire the button into the row**

In `src/components/ui/ThirdPartyAuthButtons.tsx`:

Replace the `Provider` type declaration

```ts
type Provider = "google" | "apple" | "facebook";
```

with an import of the shared vocabulary, added to the imports at the top:

```ts
import AppleAuthButton from "@/components/ui/AppleAuthButton";
import type { AuthProviderId } from "@/lib/auth/providerEmail";
```

and change every `Provider` in the file to `AuthProviderId`. Facebook is not in that union; it stays commented out and would be added to `AuthProviderId` when it is implemented.

Remove the commented-out Apple entry from `PROVIDERS` (lines 20-25) — it is now a real button below the list. Leave the Facebook comment block.

Render the Apple button after the mapped providers, inside the wrapping `<View style={styles.wrap}>`:

```tsx
      {PROVIDERS.map((p) => (
        <TouchableOpacity
          key={p.id}
          style={[styles.btn, (!p.enabled || disabled) && styles.btnDisabled]}
          disabled={!p.enabled || disabled}
          onPress={() => p.enabled && !disabled && onPress(p.id)}
          activeOpacity={0.7}
        >
          <Image source={p.icon} style={styles.btnIcon} contentFit="contain" />
          <Text style={styles.btnText}>{p.label}</Text>
        </TouchableOpacity>
      ))}
      {/* Apple is not a row entry: iOS must use Apple's own button component,
          and Android shows none at all, so it is a platform-split component
          rather than another `PROVIDERS` row. */}
      <AppleAuthButton onPress={() => onPress("apple")} disabled={disabled} />
```

- [ ] **Step 5: Extract the sign-in rule**

Create `src/lib/auth/thirdPartySignIn.ts`:

```ts
import { deleteUser, signOut } from "firebase/auth";
import { getDoc } from "firebase/firestore";

import { auth } from "../../../firebaseConfig";
import { mapDataError } from "../data/dataErrors";
import { userDoc } from "../firestore/collections";
import { WRITE_TIMEOUT_MS, writeWithTimeout } from "../firestore/writeWithTimeout";
import { signInWithApple } from "./appleSignIn";
import { signInWithGoogle } from "./googleSignIn";
import { PROVIDER_LABELS, type AuthProviderId } from "./providerEmail";

const SIGN_IN: Record<
  AuthProviderId,
  (opts?: { expectedEmail?: string }) => Promise<{ isNewUser: boolean }>
> = {
  google: signInWithGoogle,
  apple: signInWithApple,
};

/**
 * Sign in an *existing* account with a third-party provider.
 *
 * Sign-in is not registration: a provider identity with no `users/{uid}`
 * document has never been through a funnel, and would otherwise sit
 * authenticated-but-sessionless on the sign-in screen (see `AuthProvider`). It
 * is refused — and the Auth record this very call created is deleted rather
 * than left behind with no profile, no claims and no password. A record that
 * already existed is only signed out; it may belong to someone mid-registration.
 *
 * Throws an already-French `Error` with no `code`, so `frenchAuthMessage` passes
 * the message through untouched. Resolves only when a session may stand — the
 * root AuthGate then redirects on the auth-state change.
 */
export async function signInExistingAccount(
  provider: AuthProviderId,
): Promise<void> {
  const { isNewUser } = await SIGN_IN[provider]();
  const user = auth.currentUser;
  if (!user) throw new Error("La connexion a échoué. Veuillez réessayer.");

  let registered: boolean;
  try {
    // Firestore buffers a read it cannot reach the server with instead of
    // rejecting, which would leave the button disabled with no feedback, so the
    // read is raced against the shared fail-fast timeout.
    registered = (
      await writeWithTimeout(
        () => getDoc(userDoc(user.uid)),
        () => {},
        WRITE_TIMEOUT_MS,
      )
    ).exists();
  } catch (e) {
    // Firestore codes (`unavailable`, `permission-denied`) are not auth codes:
    // `frenchAuthMessage` would fall through to the SDK's English message, so
    // they are mapped here through the data-error counterpart.
    await signOut(auth);
    throw new Error(mapDataError((e as { code?: string }).code ?? ""));
  }

  if (!registered) {
    if (isNewUser) await deleteUser(user).catch(() => signOut(auth));
    else await signOut(auth);
    throw new Error(
      `Aucun compte Bike-eco n’est associé à ce compte ${PROVIDER_LABELS[provider]}. Créez un compte pour continuer.`,
    );
  }
}
```

- [ ] **Step 6: Rewire the sign-in screen**

In `src/app/(auth)/signin.tsx`:

Replace the import

```ts
import { signInWithGoogle } from "@/lib/auth/googleSignIn";
```

with

```ts
import type { AuthProviderId } from "@/lib/auth/providerEmail";
import { signInExistingAccount } from "@/lib/auth/thirdPartySignIn";
```

Delete the now-unused imports that only the inlined block needed: `mapDataError` from `@/lib/data/dataErrors`, `userDoc` from `@/lib/firestore/collections`, the `WRITE_TIMEOUT_MS` / `writeWithTimeout` import, `getDoc` from `firebase/firestore`, and `deleteUser` and `signOut` from the `firebase/auth` import (keep `sendPasswordResetEmail` and `signInWithEmailAndPassword`). Let `npx expo lint` confirm none is still referenced.

Replace the whole `googleSigningIn` block (lines 57-108) with:

```ts
  const providerSigningIn = useAsyncAction(
    async (provider: AuthProviderId) => {
      clearMessages();
      await signInExistingAccount(provider);
      // The root AuthGate redirects on the resulting auth-state change.
    },
    // `signInExistingAccount` throws either a Firebase `auth/*` error or one of
    // our own already-French errors ("Connexion Apple annulée.", an email
    // mismatch, an unregistered identity); `frenchAuthMessage` tells them apart.
    { mapError: frenchAuthMessage, onError: setError },
  );
```

Replace the `ThirdPartyAuthButtons` usage:

```tsx
          <ThirdPartyAuthButtons
            onPress={(provider) => void providerSigningIn.run(provider)}
            disabled={providerSigningIn.pending}
          />
```

- [ ] **Step 7: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green. Lint will flag any import left unused by Step 6 — remove it rather than suppressing the rule.

- [ ] **Step 8: Commit**

```bash
git add src/components/ui src/lib/auth/thirdPartySignIn.ts "src/app/(auth)/signin.tsx"
git commit -m "feat: Apple sign-in on the sign-in screen

Apple's own button on iOS (WHITE_OUTLINE, app radius and height), an
approved-title custom button on web, nothing on Android. The screen's
refuse-an-unregistered-identity rule moves to signInExistingAccount so both
providers share it instead of duplicating forty lines, and one pending flag
now locks the whole button row.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011PzhqdqB5zaYu9SDmoTHn2"
```

---

### Task 7: Apple in both registration funnels

`AccountFields` is shared by the company and invited funnels, so one change covers both call sites.

**Files:**
- Modify: `src/features/registration/fields.tsx:26-54,84-89`

**Interfaces:**
- Consumes: `signInWithApple` (Task 5); `useProviderAuthReporter`, `PROVIDER_PASSWORD_PLACEHOLDER` (Task 4); `AuthProviderId` (Task 1).
- Produces: nothing new.

**Testing note:** no tests — this is a component. Gated by `tsc` + lint.

- [ ] **Step 1: Generalise the sign-in action**

In `src/features/registration/fields.tsx`, replace the import

```ts
import { signInWithGoogle } from "@/lib/auth/googleSignIn";
```

with

```ts
import { signInWithApple } from "@/lib/auth/appleSignIn";
import { signInWithGoogle } from "@/lib/auth/googleSignIn";
import type { AuthProviderId } from "@/lib/auth/providerEmail";
```

Add the provider map at **module scope**, directly under the imports and outside `AccountFields` — it closes over nothing, so rebuilding it every render would be pointless churn:

```ts
const SIGN_IN: Record<
  AuthProviderId,
  (opts?: { expectedEmail?: string }) => Promise<{
    prenom: string | null;
    nom: string | null;
    email: string | null;
  }>
> = { google: signInWithGoogle, apple: signInWithApple };
```

Then replace the whole `googleSigningIn` action inside `AccountFields` with a provider-parameterised one:

```ts
  // Third-party sign-in plus a step advance — the same round-trip `signin.tsx`
  // guards, which this screen used to fire with no feedback and no guard at all.
  const providerSigningIn = useAsyncAction(
    async (provider: AuthProviderId) => {
      // Invited flow only (`emailDisabled` locks the email to the invitation):
      // a mismatch throws, so `onProviderProfile` below is never reached and the
      // funnel stays on this step instead of failing at the final submit.
      const profile = await SIGN_IN[provider]({
        expectedEmail: emailDisabled ? form.getValues("email") : undefined,
      });
      form.setValue("prenom", profile.prenom ?? "");
      form.setValue("nom", profile.nom ?? "");
      if (!emailDisabled) form.setValue("email", profile.email ?? "");
      // Provider flows use the authenticated identity from Auth, so the account
      // step should not block on a manual password. Seed a non-empty placeholder
      // so the shared step-validator can advance to the coordinates step. Both
      // fields get the same value — the schema's equality check runs on this
      // step, so seeding only `password` would block the provider path.
      form.setValue("password", PROVIDER_PASSWORD_PLACEHOLDER);
      form.setValue("confirmPassword", PROVIDER_PASSWORD_PLACEHOLDER);
      await onProviderProfile(profile, provider);
    },
    {
      mapError: frenchAuthMessage,
      onError: (message) => alertDialog("Connexion", message),
    },
  );
```

Note the dialog title changes from `"Connexion Google"` to `"Connexion"`: the row now offers two providers and the message itself already names the one that failed.

- [ ] **Step 2: Point the button row at it**

Replace the `ThirdPartyAuthButtons` usage in `AccountFields`:

```tsx
      <ThirdPartyAuthButtons
        onPress={(provider) => void providerSigningIn.run(provider)}
        disabled={providerSigningIn.pending}
      />
```

- [ ] **Step 3: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green.

- [ ] **Step 4: Confirm both funnels got the change**

Run: `grep -rn "AccountFields" src/features/b2b-registration/steps.tsx src/features/b2b-invited-registration/steps.tsx`
Expected: `b2b-registration/steps.tsx:44` renders `<AccountFields />` and `b2b-invited-registration/steps.tsx:28` renders `<AccountFields emailDisabled />` — one component, both funnels, so Steps 1-2 covered both. The `emailDisabled` prop is what routes the invited funnel through the `expectedEmail` check.

- [ ] **Step 5: Commit**

```bash
git add src/features/registration/fields.tsx
git commit -m "feat: Apple sign-in in both registration funnels

AccountFields is shared by the company and invited funnels, so one
provider-parameterised action covers both. The invited funnel passes the
invitation address as expectedEmail, which the Apple module checks before the
credential reaches Firebase whenever Apple tells it the address.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011PzhqdqB5zaYu9SDmoTHn2"
```

---

### Task 8: Specs and the auth skill

Per `AGENTS.md` a spec stays in sync in the change that alters its feature. This is the last task only because it describes the finished behaviour; it is not optional.

**Files:**
- Modify: `docs/specs/page-login-signup.md`
- Modify: `docs/specs/form-b2b-company-registration.md`
- Modify: `docs/specs/form-b2b-invited-registration.md`
- Modify: `.claude/skills/bike-eco-auth/SKILL.md`

- [ ] **Step 1: Update `page-login-signup.md`**

Replace the "Three Buttons for third party auth" block. Read the current wording first and keep its voice; the replacement must say:

- The providers offered are Google (all platforms) and Apple (iOS and web only — no Apple button on Android). Facebook remains disabled.
- On iOS the Apple button is Apple's own system button ("Continuer avec Apple"); on web it is the outlined button with the same approved title.
- The Google paragraph's rule now applies to both providers: sign-in is reserved for accounts already registered, and an identity with no `users/{uid}` is refused with "Aucun compte Bike-eco n’est associé à ce compte Google." or "… à ce compte Apple.", the Auth record that attempt created being deleted and a pre-existing one only signed out.
- A cancelled Apple sheet shows "Connexion Apple annulée."
- The buttons are disabled together during any round-trip.

- [ ] **Step 2: Update both form specs**

In `docs/specs/form-b2b-company-registration.md` and `docs/specs/form-b2b-invited-registration.md`, wherever the "Votre compte" step describes the Google button and its behaviour, generalise it to Google **and** Apple:

- Either provider signs the user in and advances the step; the password fields are not filled by the user in that mode.
- Prénom and nom are prefilled when the provider supplies them. **Apple supplies them only on the very first authorization for that Apple ID** — on any later sign-in the fields stay empty and the user types them on "Vos coordonnées", which is the normal password-flow behaviour.
- In `form-b2b-invited-registration.md` only: the account chosen must be the invitation's address, and this is now checked before the credential reaches Firebase whenever the provider discloses the address, and immediately after (undoing the sign-in) when it does not. The mismatch message names the provider: "Le compte Apple x@y.fr ne correspond pas à l'invitation envoyée à …".
- Note that an `@privaterelay.appleid.com` address from Apple's "Masquer mon adresse email" is accepted, and that mail to such an address will not be delivered until the sender domain is registered with Apple's private email relay service.

- [ ] **Step 3: Update the auth skill**

In `.claude/skills/bike-eco-auth/SKILL.md`:

Update the Layout table: `googleSignIn.ts` / `.web.ts` row gains `appleSignIn.ios.ts` / `.web.ts` / `.ts`; the `googleEmail.ts` row becomes `providerEmail.ts` — `emailsMatch` + `ProviderEmailMismatchError` + `AuthProviderId`; add a row for `thirdPartySignIn.ts` — `signInExistingAccount`, the sign-in-is-not-registration rule.

Rewrite the "Adding a third-party provider" section so it teaches the Apple lessons alongside the Google ones. It must state:

- The four Google rules already listed still hold.
- **The platform split is per-provider, not universal.** Google's native module runs on iOS and Android, so `.ts` + `.web.ts` is right. Apple's does not, so Apple needs three files: `.ios.ts`, `.web.ts`, and a plain `.ts` for Android that reports unavailable. Getting this wrong breaks the Android build with no type error.
- **Nonce direction (iOS):** Apple gets the SHA-256 **hex digest**, Firebase gets the **raw** nonce. Backwards gives `auth/missing-or-invalid-nonce`. Web needs no nonce at all — `signInWithPopup` owns the flow.
- **Apple only tells you the name and email on the first authorization.** So the invited funnel's compare-before-`signInWithCredential` rule cannot always be honoured: tier 1 compares whatever the credential or the identity token discloses; tier 2 signs in, compares `auth.currentUser.email`, and undoes (`deleteUser` when `isNewUser`, else `signOut`). Never leave a refused identity signed in.
- **Cancellation must be rethrown without its code.** `ERR_REQUEST_CANCELED` is a `code` that is not an `auth/*` code, so `frenchAuthMessage` would flatten it to the generic failure copy. Rethrow `new Error("Connexion Apple annulée.")`.
- The identity-token email decoder is **unverified on purpose** and is a hint, never authorization; the server still checks.

Add to the "Common mistakes" table:

| Mistake | Consequence |
|---|---|
| Giving Apple the raw nonce and Firebase the digest | `auth/missing-or-invalid-nonce` on every attempt |
| Expecting Apple's name/email on a repeat sign-in | Empty prefill treated as a bug; a mismatch check that silently never runs |
| Letting `ERR_REQUEST_CANCELED` keep its code | A plain "Annuler" shows "La connexion a échoué" |
| Putting Apple's native module in the plain `.ts` file | Android build breaks; no type error warns you |

- [ ] **Step 4: Run the gate**

Run: `npx tsc --noEmit && npx expo lint && npm test`
Expected: all green (documentation-only, but the gate is cheap and confirms nothing was disturbed).

- [ ] **Step 5: Commit**

```bash
git add docs/specs .claude/skills/bike-eco-auth/SKILL.md
git commit -m "docs: record Apple sign-in in the specs and the auth skill

The login page and both registration form specs describe Apple alongside
Google, including the first-authorization-only name and email and the accepted
private-relay addresses. The auth skill gains the per-provider platform split,
the nonce direction, the two-tier email check and the cancellation contract.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011PzhqdqB5zaYu9SDmoTHn2"
```

---

## Owner prerequisites — cannot be performed from this repo

None of the tasks above are blocked by these, and every one of them is verifiable through the gate without them. **Apple sign-in cannot be exercised on a device until 1–3 and 6 are done**, so testing stops at the gate until then.

1. **Apple Developer → Certificates, Identifiers & Profiles**: enable the **Sign In with Apple** capability on `com.bikeeco.app`.
2. **Apple Developer**: create a **Services ID** registering the return URL `https://bike-eco-43a84.firebaseapp.com/__/auth/handler`, and create a **Sign in with Apple private key** (note the key ID and the team ID). Firebase requires these even for an iOS-only integration; the web popup requires the Services ID specifically.
3. **Firebase console → Authentication → Sign-in method**: enable **Apple** and fill in the Services ID, Apple Team ID, key ID and private key.
4. **Firebase console → Authentication → Settings**: confirm whether the project is on "Link accounts that use the same email" — that setting alone decides what happens when an Apple identity's email already has a password account, and it already governs Google identically.
5. *(optional)* Register the SMTP sender domain with Apple's private email relay service, so mail to an `@privaterelay.appleid.com` address is actually delivered.
6. **An EAS iOS build.** `expo-apple-authentication` is a native module, so the dev client must be rebuilt; this machine is Linux and `npx expo run:ios` is unavailable. The build is paid — it will be proposed, never triggered unasked.
