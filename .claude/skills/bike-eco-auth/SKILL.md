---
name: bike-eco-auth
description: >-
  Use when touching sign-in, sign-up, sign-out, passwords, or who-can-see-what in
  the bike-eco Expo app — change password, forgot/reset password, an emailed or
  deep-linked auth token, adding a third-party provider (Apple, Facebook, Google),
  surfacing a failed sign-in, back-office team member add/delete/recovery, custom
  claims, role or status gating, a redirect that sends the user to the wrong screen,
  or a new screen reachable without being logged in.
---

# Auth in bike-eco

Firebase Auth, with **custom claims as the source of truth** for privileged fields.
`role`, `companyId` and `status` are set server-side by callables and are never
client-writable. A stale `users/{uid}` profile can't grant access — `buildSessionUser`
lets claims win over the profile doc on purpose.

Read `docs/specs/page-login-signup.md` before touching the sign-in screen. Gate every
change with `docs/tech/verification.md`.

## Layout

| File | Responsibility |
|---|---|
| `src/lib/auth/AuthProvider.tsx` | `useAuth()` context: `firebaseUser`, `session`, `status`, `loading`, `initializing`, `signOut`, `refreshSession` |
| `src/lib/auth/session.ts` | `parseClaims` (raw token bag → typed) + `buildSessionUser` (claims + profile → `SessionUser`) |
| `src/lib/auth/routeGuard.ts` | Pure `resolveAuthRoute` + `redirectFor`. The whole redirect policy |
| `src/lib/auth/authErrors.ts` | `mapAuthError(code)` — the only place auth copy lives |
| `src/lib/auth/googleSignIn.ts` / `.web.ts` | Provider sign-in, platform-split |
| `src/lib/auth/googleEmail.ts` | `emailsMatch` + `GoogleEmailMismatchError` |
| `src/lib/data/registration.ts` | Client wrappers over the registration callables |
| `src/features/registration/fields.tsx` | `AccountFields`, `CoordonneesFields` — shared form groups |

## Adding a screen reachable while logged out

**This is the most common way to break auth.** `redirectFor` bounces any unauthenticated
user to `/(auth)/signin` unless the top segment is `(auth)` or listed in
`PUBLIC_SEGMENTS` (`routeGuard.ts`), today `index` and `b2cSubmissionForm`.

A forgot-password screen or an emailed reset-token screen is reached by someone who is
**not** signed in. Put it under `(auth)/` (which is already exempt) or add its top
segment to `PUBLIC_SEGMENTS`. Skip this and the screen redirects to sign-in the instant
it mounts — and it will look like the link is broken, not like a guard problem.

`resolveAuthRoute` and `redirectFor` are pure and unit-tested (`routeGuard.test.ts`).
Change routing policy there, with a test — never by scattering `router.replace` calls in
screens.

## Claims set after sign-in need `refreshSession()`

`onAuthStateChanged` does **not** re-fire when custom claims change. Any flow where the
server sets claims *after* the user is already signed in (Google registration today;
back-office team-member creation next) must call `refreshSession()` from `useAuth()`, or
the session keeps the pre-claims role and the guard routes to the wrong place.

`AuthProvider` guards session loads with a `generationRef` counter: a later load
invalidates an in-flight earlier one so a slow read never clobbers a fresher result. Any
new path that loads a session must keep that discipline. If a session load throws, it
must fail to a **null session** — leaving `loading` stuck true silently kills every
redirect in the app, and a tap on sign-in appears to do nothing at all.

## Error copy

Every Firebase Auth failure goes through `mapAuthError(code)`; the fallback is
`"La connexion a échoué. Veuillez réessayer."`. Adding a flow means adding its codes to
that map — copy must be specific and actionable, never `"Erreur"`.

Codes the current map does **not** cover, needed by the coming password work:

| Flow | Codes to add |
|---|---|
| Change password | `auth/requires-recent-login` (re-authenticate before `updatePassword`), `auth/weak-password` |
| Forgot / reset password | `auth/expired-action-code`, `auth/invalid-action-code` |

Callable errors are a **separate** map — `frenchError` in `src/lib/data/callable.ts`. See
`bike-eco-functions`.

Never reveal whether an address has an account. The forgot-password screen shows the same
confirmation either way.

## Adding a third-party provider

`googleSignIn.ts` is the template Apple and Facebook clone. Four things it does that a
naive implementation misses:

1. **`signOut()` the provider SDK first.** Android silently reuses the last account
   otherwise, and the user never sees the chooser.
2. **Compare the email _before_ `signInWithCredential`.** For invited registration the
   picked account must match the invitation. Checking after means Firebase has already
   created an Auth record with no profile, no claims and no password — unreachable, and
   impossible to clean up from the client.
3. **Return `isNewUser`** (`getAdditionalUserInfo(cred)?.isNewUser`) so a caller that
   rejects the identity can delete the record it just created.
4. **Read client ids from `process.env.EXPO_PUBLIC_*`**, never hardcoded.

**Platform split:** native-only SDKs get a `.web.ts` sibling (`googleSignIn.ts` /
`googleSignIn.web.ts`, also `region-store.ts` / `.web.ts`). Metro picks the web file on
web. Both files must export the same signature or the web build breaks silently.

## Deep-linked token routes

`src/app/(auth)/invite-code.tsx` + the `resolveInvite` callable are the precedent for the
emailed password-reset link: the app opens on a route carrying an opaque token, a callable
validates it server-side, and the screen renders only after it resolves. Tokens are stored
**hashed** (`Invitation.tokenHash`) — never the raw token.

## Common mistakes

| Mistake | Consequence |
|---|---|
| New logged-out screen not in `PUBLIC_SEGMENTS` / `(auth)` | Instantly redirects to sign-in; looks like a broken link |
| Reading `role`/`status` from the `users` doc instead of the session | Stale profile grants wrong access; claims are authoritative |
| Setting `role`/`companyId`/`status` from the client | Rejected by rules — these are server-set claims only |
| Skipping `refreshSession()` after server-set claims | Session keeps the old role until a full app restart |
| Inline French copy in a screen | Bypasses `mapAuthError`; copy drifts between flows |
| `updatePassword` without handling `auth/requires-recent-login` | Fails for any session older than a few minutes |
| Adding a native SDK without a `.web.ts` sibling | Web build breaks |
