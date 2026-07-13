# Slice 1 — Auth + Session + Security Rules (design)

_Date: 2026-07-13 · Branch: `feat/init-firestore-and-storage`_

## Context

"Wire the project to Firestore" spans several interdependent subsystems. We
decomposed it into four slices, built in dependency order:

1. **Auth + session + security rules** *(this spec — the keystone)*
2. Dossier reads (swap the four read hooks to `onSnapshot` listeners)
3. Dossier writes & B2B submission (Firestore writes + Storage upload)
4. Registration flows (Cloud Functions that create Auth users and set claims)

Everything past Slice 1 depends on a real authenticated identity carrying custom
claims (`role`, `companyId`, `region`, `status`), because the security model is
default-deny, auth-required, and claim-scoped. Today there is **no Firebase Auth
at all**: `firebaseConfig.ts` exports only `app`/`db`/`storage`, and
`useSession` is a `useState` role-toggle backed by `MOCK_USERS`. This slice
builds that keystone.

### Current state (verified)

- `firebaseConfig.ts` — `app`, `db` (named DB `bike-eco-db`), `storage`. No `auth`.
- `src/lib/firestore/{schema,collections}.ts` — complete, converter-backed. Reused as-is.
- `useSession` / `useAccount` — stubbed against `MOCK_USERS`.
- `signin.tsx` — no auth; `SignInFields.onSubmit` and `ThirdPartyAuthButtons.onPress`
  both just `router.replace(DASHBOARDS[role])`. A `__DEV__` role-toggle switches identity.
- Backend: `functions/` codebase deployed (B2C email function). **No `firestore.rules`,
  `storage.rules`, indexes, or firestore/storage/auth sections in `firebase.json`.**
- App config: `expo-dev-client` present (native modules OK); web is a static build
  target; `reactCompiler` + typed routes on. Deps: `firebase@^12`. No async-storage,
  google-signin, or auth-session yet.

## Decisions (locked)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Sign-in methods wired now | **Email/password + Google.** Apple/Facebook rendered disabled ("bientôt disponible"), deferred. |
| 2 | Dev/test environment | **Firebase Emulators** (Auth + Firestore + Storage), extending the existing Functions-emulator pattern. |
| 3 | Test users (registration is Slice 4) | **Admin SDK seed script** creating a b2b + a backoffice user with claims and matching docs. |
| 4 | `pending`/`rejected` account status | **Blocked** with a "Compte en attente de validation" screen; no dashboard access. |
| 5 | Google vs. emulator | **Wire Google, verify against the live Auth project.** Email/password + rules verified on emulators. |

## Architecture

### 1. Firebase Auth init (platform split)

Mirror the existing `region-store.ts` / `region-store.web.ts` convention.

- **`firebaseConfig.ts`** (native): add
  ```ts
  export const auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
  ```
  Imports: `initializeAuth`, `getReactNativePersistence` from `firebase/auth`;
  `AsyncStorage` from `@react-native-async-storage/async-storage` (new dep, via
  `npx expo install`).
- **`firebaseConfig.web.ts`** (web): `export const auth = getAuth(app);` (browser
  persistence by default). Re-exports `app`/`db`/`storage` so imports are identical
  across platforms. `db`/`storage`/`app` are unchanged from today.
- **Emulator wiring**: when `__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS`, call
  `connectAuthEmulator(auth, "http://<host>:9099")`, `connectFirestoreEmulator`, and
  `connectStorageEmulator`. Reuse the B2C host convention (`10.0.2.2` on Android,
  `localhost` otherwise). This lets a dev also point at the live project by leaving
  the flag unset — required for verifying Google (Decision 5).

> Caveat to handle at implementation time: `getReactNativePersistence` has had
> missing/soft-deprecated typings across firebase 11→12. If the type is absent, add
> a narrow local `d.ts` or `as` cast rather than changing runtime behavior.

### 2. Session provider & claims

- New **`AuthProvider`** (React Context) in `src/lib/data/` (or `src/lib/auth/`),
  mounted in `src/app/_layout.tsx` above the router.
  - Subscribes to `onAuthStateChanged`.
  - On a user: `getIdTokenResult()` → read claims `role`, `companyId`, `region`,
    `status`; and load the `users/{uid}` doc for profile fields (nom, prénom, etc.).
  - Exposes `{ firebaseUser, claims, profile, status, loading, signOut }`.
  - `loading` is `true` until the first auth state + claims resolve (drives the guard's splash).
- **`useSession()` rewritten** to consume the context: `{ user, role, status, loading, signOut }`,
  where `user` is assembled from claims + the `users` doc (shape-compatible with the
  screens that consume it today). Remove the `__DEV__` role-toggle and `MOCK_USERS` import.
- **`useAccount()`** returns the real `users/{uid}` profile. This is the first genuine
  Firestore read and end-to-end-validates auth → claims → rules → read.
- **Scope note:** `fixtures.ts` / `MOCK_DOSSIERS` and the dossier read hooks
  (`useDossiers`/`useDossier`/`useMessages`) are **not** touched here — they belong
  to Slice 2. Only the session/account fixtures are removed.

### 3. Sign-in / sign-out wiring

- **`SignInFields`** → `signInWithEmailAndPassword(auth, email, password)`. Keep Zod
  validation on blur (form conventions). Map Firebase error codes to specific French
  copy:
  - `auth/invalid-credential` / `auth/wrong-password` / `auth/user-not-found` →
    "Email ou mot de passe incorrect."
  - `auth/too-many-requests` → "Trop de tentatives. Réessayez plus tard."
  - `auth/network-request-failed` → "Connexion impossible. Vérifiez votre réseau."
  - fallback → "La connexion a échoué. Veuillez réessayer."
- **`ThirdPartyAuthButtons`**: Google wired.
  - Native: `GoogleSignin.configure({ webClientId, iosClientId })`, `signIn()`,
    `getTokens()` → `signInWithCredential(auth, GoogleAuthProvider.credential(idToken))`.
  - Web: `signInWithPopup(auth, new GoogleAuthProvider())`.
  - Apple + Facebook buttons rendered **disabled** with "bientôt disponible". Not removed.
  - New dep: `@react-native-google-signin/google-signin` + its config plugin in `app.json`.
- **"Mot de passe oublié"** → `sendPasswordResetEmail(auth, email)` with a confirmation toast/message.
- **Sign-out** added to the settings screen (alongside the existing invite/delete stubs;
  `signOut(auth)` then redirect to `/(auth)/signin`).
- After successful sign-in, navigation is driven by the guard (Section 4), **not** by a
  hardcoded `DASHBOARDS[role]` replace — the guard reacts to auth state centrally.

### 4. Route guards & pending gate

- `src/app/_layout.tsx` becomes auth-aware (consuming `AuthProvider`):
  - `loading` → splash/loading screen (prevents a flash of the wrong group).
  - No user → redirect to `/(auth)/signin`. The `(auth)` group and the public B2C funnel
    (`/b2cSubmissionForm`, `/index`) remain reachable without auth.
  - User + `status !== "active"` → **"Compte en attente de validation"** screen; dashboards blocked.
  - User + `status === "active"` → allow the role-appropriate group (`(b2b)` vs `(backoffice)`).
- Remove the manual `router.replace(DASHBOARDS[role])` from `signin.tsx`; the guard owns routing.

### 5. Security rules, emulator config & seed

- **`firestore.rules`** — default-deny; every rule requires `request.auth != null`.
  Claim-scoped per collection (high-level intent; exact rules written during
  implementation with the **firebase-firestore** + **firebase-security-rules-auditor**
  skills active):
  - `users/{uid}` — owner reads/writes profile fields; `role`/`companyId`/`region`/`status`
    are **never** client-writable (server/claims only).
  - `companies/{id}` — read by members of that company + backoffice; not client-writable here.
  - `dossiers/{id}` — read by the owning company (`companyId` claim) or backoffice; scoped
    listeners land in Slice 2 but the rules are authored now so reads are testable.
  - `dossiers/{id}/messages/{mid}` — participants only.
  - `invitations/{id}` — locked down (registration is Slice 4).
- **`storage.rules`** — default-deny; authored now, exercised in Slice 3.
- **`firebase.json`** — add `firestore` (rules + indexes, pointing at `bike-eco-db`),
  `storage`, and emulator ports (`auth: 9099`, `firestore: 8080`, `storage: 9199`, plus the
  existing `functions: 5001` and Emulator UI). Add `firestore.indexes.json` (empty to start).
- **`scripts/seed.ts`** (firebase-admin, run against the emulators): idempotently creates
  - a **b2b** user (claims `role:b2b`, `companyId`, `status:active`) + `companies/{id}` + a couple of `dossiers`,
  - a **backoffice** user (claims `role:backoffice`, `region`, `status:active`),
  - and (for testing Decision 4) a **pending** b2b user.
  Documented `npm` script to run it. This replaces the `__DEV__` role-toggle for previewing both roles.

## Out of scope (deferred)

- Registration Cloud Functions & `submitCompanyRegistration` / `submitInvitedRegistration` / `invite` — **Slice 4**.
- Dossier read listeners (`useDossiers`/`useDossier`/`useMessages`), removal of `fixtures.ts` — **Slice 2**.
- Dossier writes (`useDossierMutations`) & `submitB2bSubmission` + Storage upload — **Slice 3**.
- Apple & Facebook providers — later (buttons disabled for now).

## Manual setup required (owner, cannot be automated here)

1. Firebase console: enable **Email/Password** and **Google** sign-in providers.
2. Download `google-services.json` (Android) + `GoogleService-Info.plist` (iOS); wire via the
   google-signin config plugin in `app.json`.
3. Obtain the OAuth **webClientId** (and iOS client ID / URL scheme) for `GoogleSignin.configure`.
4. Dev-client rebuild so the Google native module links: `npx expo prebuild --clean` then
   `npx expo run:ios` / `run:android`.

## Verification strategy

- **Emulator-testable now**: email/password sign-in, sign-out, password reset, the pending gate,
  route guards, `useAccount` real read, and every security rule (via seeded users + rules unit tests).
- **Live-verified** (Decision 5): Google sign-in on native + web.
- Success = a seeded b2b user signs in with email/password against the emulators, lands on the
  b2b dashboard, `useAccount` shows their real profile from Firestore; the pending user is blocked;
  the backoffice user routes to the backoffice group; Google sign-in succeeds against live.

## New dependencies

- `@react-native-async-storage/async-storage` (auth persistence, native)
- `@react-native-google-signin/google-signin` (+ config plugin)
- `firebase-admin` is already in `functions/`; the seed script reuses it (or a root devDependency if run standalone).
