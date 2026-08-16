---
name: bike-eco-functions
description: >-
  Use when working in functions/ of the bike-eco app — adding or changing a
  callable or HTTP endpoint, server-side validation of a request payload,
  privileged writes or custom claims, sending a transactional email, rate limits
  or abuse guards, App Check, secrets, the Firebase emulators, deploying
  functions, or an error surfacing in the app as the wrong French message.
---

# Cloud Functions in bike-eco

Gen 2 `firebase-functions`, TypeScript, deployed from `functions/`. Anything the client
must not be trusted to do — creating Auth users, setting custom claims, stamping a sender
name, sending email — lives here. Gate with `docs/tech/verification.md`.

## Module layout

Every feature is three files. The split exists so the logic is testable without the
Firebase runtime.

| File | Contents | Tested |
|---|---|---|
| `core.ts` | Pure logic, all I/O injected via a `Deps` object | **Yes** — the real unit tests |
| `schemas.ts` | Zod v4 schemas validating the request payload | **Yes** |
| `index.ts` | Thin `onCall` wiring: parse → call core → `toHttps` | No |

`registration/` and `messages/` both follow it. A new callable does too — resist putting
logic straight in `index.ts`, because nothing there is reachable from a unit test.

`users/` is the third module: `setColleagueAdmin` / `deleteColleague` / `deleteMyAccount`.
`RegError` and `CallerClaims` now live in the shared `functions/src/errors.ts`, not in
`registration/core.ts` — import them from there for any new module.

The `Deps` pattern: `core.ts` declares an interface (`Deps`, `BackofficeDeps`) of the
operations it needs (`createUser`, `setClaims`, `writeCompany`, `sendInviteEmail`, `now`),
and `index.ts` supplies a `realDeps()` built from the admin SDK. Tests pass fakes.

## Callable boilerplate

Two wrappers in `functions/src/callable.ts` own the whole sequence — auth guard, schema
parse, core call, `toHttps` funnel. **Use them; do not hand-write `onCall`.**

```ts
// signed-in callers only — `caller` is CallerClaims from the verified token
export const doThing = authedCall(doThingSchema, (input, caller) =>
  doThingCore(input, caller, realDeps()),
);

// reachable while signed out (registration / invitations)
export const acceptInvite = publicCall(acceptInviteSchema, (input, who) =>
  acceptInviteCore(input, who.uid, who.email, realDeps()),
);

// options (e.g. secrets) are the third argument
export const sendInvite = authedCall(sendInviteSchema, run, { secrets: B2C_EMAIL_SECRETS });

// no payload: NO_PAYLOAD ignores req.data rather than trusting it
export const deleteMyAccount = authedCall(NO_PAYLOAD, (_i, caller) => ...);
```

A `core` resolving to nothing gets the `{ ok: true }` acknowledgement the client's
`call()` expects; one resolving to a value returns it verbatim.

From `functions/src/callable.ts`:

- **`db()`** — the admin Firestore handle for the **named `bike-eco-db`** database. Never
  `getFirestore()` bare; that targets `(default)` and silently reads nothing.
- **`callerFrom(req)`** — `{ uid, role, status, companyId }` from the verified token.
  Claims come from the token, never from `req.data`.
- **`toHttps(err)`** — the single error funnel: `RegError` → its own code, `ZodError` →
  `invalid-argument`, known `auth/*` codes → French `HttpsError`, anything else → logged
  and rethrown as a generic `internal`. Raw internals never reach the client.
- Add `{ secrets: B2C_EMAIL_SECRETS }` to any callable that sends email.

Callables that must reject unauthenticated callers do so explicitly — `onCall` does not.

## The error contract crosses the wire

Server `toHttps()` pairs with client `frenchError()` in `src/lib/data/callable.ts`, and
**a server-authored `HttpsError` message wins** over the client's generic per-code map.
So a specific French message written server-side reaches the user verbatim; a bare code
falls back to the client map. Changing copy on one side means checking the other.

## Validation

Every payload is parsed with a Zod v4 schema before it reaches core logic —
`req.data` is attacker-controlled. Limits belong in the schema, where they are testable:
`text` max 4096 chars, `attachments` max 5, attachment `size` max 10 MB, `name` max 255,
plus a `.refine` requiring text or an attachment (`messages/schemas.ts`).

Server-side checks that cannot be expressed in a schema go in `core.ts`: `messages/core.ts`
verifies the caller is the owning dealer or back-office, and that every attachment URL is
a real Storage host whose object path sits under this dossier's message folder — parsed
properly, not substring-matched.

The B2C endpoint (`index.ts`, `onRequest` + busboy) is the exception: multipart, public,
so it caps file size (8 MB), file count (12) and field size before buffering.

## Email

`email.ts` owns sending and region routing (NORTH/SOUTH mailboxes; `regions.ts`).

**`DEV_EMAIL_OVERRIDE` is `false`** — real recipients now receive mail. It is a module
constant, not an env var, so with it `false` the dev-redirect branches are statically
dead; they are kept as the switch back for local testing. `NORTH_MAILBOX` and
`SOUTH_MAILBOX` are still both the dev address, so `resolveRegion` routing has no
observable effect until those are set to the real mailboxes.

## App Check

Not yet enforced on any callable — the open launch-hardening item. Enforcing it means
`{ enforceAppCheck: true }` on the callables plus client attestation, and it is
owner-dependent (console setup).

## Emulators and deploy

`callable.ts` points the admin SDK at the local emulators whenever
`NODE_ENV !== "production"`. Deployed Gen 2 functions always run with
`NODE_ENV="production"`, so the block is skipped in prod — don't add a manual flag.

```bash
# Both lines: firebase-tools resolves `java` from PATH, so JAVA_HOME alone
# still fails with "no longer supports Java version before 21".
export JAVA_HOME=/usr/local/jdk-26.0.1
export PATH="$JAVA_HOME/bin:$PATH"

npx firebase-tools@latest emulators:start
npm run test:rules          # rules tests, emulator-backed
```

Use `firebase-tools@latest`; a JDK error means raising `JAVA_HOME` (system default is 17),
not pinning an older major.

`setGlobalOptions({ maxInstances: 10, region: "europe-west9" })` bounds autoscaling blast
radius and pins **every** function to `europe-west9`, co-located with `bike-eco-db` and
the Storage bucket (both are there, and neither location can be changed after creation).
A function buffering uploads in memory also sets its own `memory` and `concurrency`.

**The region is a two-sided contract.** Changing it means changing the callers in the same
commit — `getFunctions(app, "europe-west9")` in `firebase.core.ts` and the `REGION`
constant in `src/features/b2c-submission/submit.ts` (a bare `fetch`, so it builds its own
URL). A mismatch is silent: the SDK calls a URL with no function behind it and the user
sees the generic `internal` message. Note also that a region change is **not** an in-place
update — the CLI creates the function in the new region and deletes the old one, so any
already-shipped client pinned to the old region breaks permanently.

## Common mistakes

| Mistake | Consequence |
|---|---|
| Logic in `index.ts` instead of `core.ts` | Untestable; the house tests live at the core layer |
| `getFirestore()` instead of `db()` | Targets `(default)`; reads return nothing |
| Trusting `req.data` for `role` / `companyId` | Privilege escalation — read claims via `callerFrom` |
| `onCall` without an explicit `req.auth` check | Unauthenticated callers reach the core |
| Throwing raw errors instead of `toHttps` | Internal details leak; client shows the generic fallback |
| Sending email without `{ secrets: B2C_EMAIL_SECRETS }` | Runtime failure — credentials unavailable |
| Flipping `DEV_EMAIL_OVERRIDE` back to `true` and shipping | No real recipient gets an email |
| Substring-matching a URL for validation | Bypassable; parse the URL and check host + path |
