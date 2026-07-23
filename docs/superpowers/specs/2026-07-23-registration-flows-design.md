# Slice 4a — Registration flows (design)

**Date:** 2026-07-23 · **Status:** Approved (brainstorm)

## Context

Slice 4 (registration) was decomposed into three sub-projects:
- **4a — Registration** *(this spec)*: company signup, invite-a-colleague, invited signup.
- **4b — Back-office company management**: pending banner, companies list/detail, approve
  (`Autoriser`) / decline (`Décliner`) / cascade-delete. Its own spec later.
- **4c — Message `senderName` stamping** (FR-2): independent, small. Its own spec later.

Today the three flows are UI-only stubs: `submitCompanyRegistration`,
`submitInvitedRegistration`, and `useInvite` each just sleep 400 ms. Firebase Auth exists
(Slice 1) and account claims (`role`/`companyId`/`status`) are server-set and rules-enforced,
but **nothing creates users, sets claims, or issues invitations yet**. 4a builds that.

## Goals

- **Company registration** creates a `pending` company + owner account (Auth user + claims +
  docs), then emails the applicant. The pending gate (Slice 1) blocks them until 4b activates.
- **Invite a colleague** issues a one-time, time-limited code and emails it to the invitee.
- **Invited registration** validates the code and creates an **active** member of the
  inviter's company.
- Both registration forms work with **email/password and Google**.

## Non-goals (deferred)

- The `pending → active` transition and any back-office company UI — **4b**.
- Message `senderName` server-stamping (FR-2) — **4c**.
- Apple / Facebook providers — stay disabled ("bientôt disponible").
- A welcome email to invited users (YAGNI).

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Auth-creation model | **Hybrid (Approach A).** Email/password: the callable creates the Auth user server-side (atomic: user + docs + claims). Google: client signs in first, then the **authenticated** callable writes docs + sets claims for `context.auth.uid`. |
| 2 | Invite delivery | **Typed 6-char code** (uppercase A–Z + 0–9), **1-hour** validity, one-time. The raw code is emailed; only its **hash** is stored (`Invitation.tokenHash`). |
| 3 | Google in 4a | **Included** — wires the deferred Slice 1 Google sign-in *and* Google-based registration. |
| 4 | Invited user status | **`active` immediately** — their company is already validated and a trusted member invited them. |
| 5 | SIRET uniqueness | **Enforced** — `registerCompany` rejects a SIRET already used by a pending or active company. |
| 6 | Company-reg emails | **Applicant only** ("demande reçue, en attente de validation"). **No team email** — the team is notified by the 4b dashboard banner. |
| 7 | Google profile prefill | On Google auth, prefill the coordonnées step (prénom, nom, email) from the Google profile where the provider supplies it. Best-effort — the user completes the rest. |

## Architecture

### Cloud Functions (`functions/src/`, 2nd-gen `onCall`)

Reuse the existing nodemailer/SMTP setup (`email.ts`: `defineSecret` + `DEV_EMAIL_OVERRIDE`)
and `zod` payload validation. Claims are set with `admin.auth().setCustomUserClaims`; after
any registration the client force-refreshes its token (`getIdToken(true)`) so `AuthProvider`
picks up the new claims and the guard routes correctly.

1. **`registerCompany`** — unauthenticated (password) or authenticated (Google).
   - Input: `method: "password" | "google"`, the company fields (siret, companyName) and
     profile (nom, prénom, téléphone, département, ville); plus `email`+`password` in password
     mode. In Google mode identity comes from `context.auth` (uid + verified email).
   - Rejects if the SIRET already belongs to a pending/active company.
   - Password mode: `admin.auth().createUser({ email, password })`. Google mode: uses
     `context.auth.uid`.
   - Writes `companies/{id}` (status `pending`, `createdBy = uid`, siret, name, createdAt) and
     `users/{uid}` (role `b2b`, companyId, region null, profile, status `pending`, timestamps);
     sets claims `{ role: "b2b", companyId, status: "pending" }`.
   - Emails the applicant only. Returns `{ ok: true }`.

2. **`sendInvite`** — authenticated; caller must be an **active b2b** user (claims
   `role: "b2b"`, `status: "active"`, non-null `companyId`).
   - Input: `email` (the invitee).
   - Generates a 6-char uppercase-alphanumeric code; writes `invitations/{id}` with
     `tokenHash` (a hash of the code), `email`, `companyId` (from the caller's claims),
     `invitedBy = uid`, status `pending`, `expiresAt = now + 1h`, createdAt.
   - Emails the invitee the raw code + how to use it. Returns `{ ok: true }`.

3. **`resolveInvite`** — unauthenticated, **rate-limited**.
   - Input: `code`. Hashes it, looks up a `pending`, unexpired invitation.
   - Returns `{ email, companyName }` to prefill the disabled email field, or a French
     "invalide ou expiré" error. Does **not** consume the invitation.

4. **`acceptInvite`** — unauthenticated (password) or authenticated (Google).
   - Input: `method`, `code`, profile (nom, prénom, téléphone, département, ville); `password`
     in password mode. The email is taken from the invitation, never user-supplied.
   - Re-validates the code (pending + unexpired). Password mode: `createUser({ email:
     invitation.email, password })`. Google mode: uses `context.auth.uid` and **requires the
     signed-in Google email to equal `invitation.email`**.
   - Writes `users/{uid}` (role `b2b`, companyId `= invitation.companyId`, profile, status
     **`active`**), sets claims `{ role: "b2b", companyId, status: "active" }`, and marks the
     invitation `accepted` (one-time). Returns `{ ok: true }`.

### Invite-code brute-force mitigation

A 6-char uppercase-alphanumeric code is ~2.2 B combinations. `resolveInvite` and `acceptInvite`
are the only ways to test a code and are **rate-limited** (per-caller/IP attempt throttling;
App Check recommended). Combined with the 1-hour expiry and one-time use, guessing is
impractical. Codes are never logged; only the hash is stored.

### Client wiring

- **Google sign-in** (the deferred Slice 1 work): native uses
  `@react-native-google-signin/google-signin` (`configure` → `signIn` → `getTokens` →
  `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))`); web uses
  `signInWithPopup(auth, new GoogleAuthProvider())`. Drives the Google buttons on the sign-in
  screen and both registration forms. On Google auth, the returned profile (givenName →
  prénom, familyName → nom, email) prefills the coordonnées step where available (web
  `displayName` is best-effort split).
- **Company registration** (`register.tsx` / `submitCompanyRegistration`) → `registerCompany`;
  on success force-refresh the token → the guard shows the pending gate ("Demande d'inscription
  envoyé").
- **Invite-code entry** (new, small — the typed-code UI the current specs don't cover): a step
  or screen where the invitee types the 6-char code → `resolveInvite` → the invited-registration
  form opens with the email prefilled and disabled.
- **Invited registration** (`register-invited.tsx` / `submitInvitedRegistration`) →
  `acceptInvite`; on success force-refresh → dashboard.
- **Invite a colleague** (`add-colleague.tsx` / `useInvite`) → `sendInvite` → the confirmation
  screen ("l'invitation a bien été envoyée").

### Data & rules

- `invitations` stays **fully closed to clients** — all reads/writes go through the functions
  (Admin SDK, which bypasses rules). Only `tokenHash` is stored, never the raw code.
- `companies` **create is server-only** (clients never create a company directly; only
  `registerCompany` does, via Admin SDK). `role`/`companyId`/`status` remain non-client-writable
  (existing rules unchanged).

### Emails

Reuse `functions/src/email.ts` (SMTP secrets, `DEV_EMAIL_OVERRIDE`, French copy):
- Company registration → applicant: "demande reçue, en attente de validation".
- Invite → invitee: the 6-char code + how to register with it.

## Owner manual setup (cannot be automated — same as the Slice 1 spec)

1. Firebase console: enable the **Google** sign-in provider.
2. Obtain the OAuth **webClientId** (+ iOS client ID / URL scheme).
3. Add `google-services.json` (Android) + `GoogleService-Info.plist` (iOS) and the
   `@react-native-google-signin/google-signin` config plugin to `app.json`.
4. **Dev-client rebuild** so the Google native module links (`npx expo prebuild --clean` then
   `run:ios` / `run:android`).
5. SMTP secrets already configured for the B2C email function are reused.

## Testing

- **Pure units:** invite-code generation (6-char uppercase A–Z/0–9), code hashing, expiry
  check, SIRET-format/uniqueness helper.
- **Emulator integration** (Auth + Firestore emulators) for the four callables:
  `registerCompany` creates a pending company + user with the right claims and rejects a
  duplicate SIRET; `sendInvite` writes an invitation with a hashed, 1h-expiry code (active-b2b
  caller only); `resolveInvite` returns the email for a valid code and errors on
  invalid/expired; `acceptInvite` creates an **active** user, pins the company from the
  invitation, marks it accepted, and rejects a reused/expired code.
- **Interactive walkthrough** (needs Google native config + a device) for the client paths:
  email/password + Google company registration → pending gate; invite → code email; typed code
  → invited registration → dashboard.

## Spec sync (kept in sync in the implementing change)

- `docs/specs/form-b2b-company-registration.md` and `form-b2b-invited-registration.md`: note the
  Google-profile prefill of the coordonnées step, and (invited) the preceding typed invite-code
  entry.
- `docs/specs/page-add-colleague.md`: the invite is now a real one-time 1-hour code.
