# Auth + Session + Security Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a real Firebase Authentication foundation — sign-in (email/password + Google), a claims-backed session provider, route guards with a pending-account gate, and default-deny Firestore/Storage security rules — replacing the stubbed `useSession` role-toggle.

**Architecture:** Firebase JS SDK v12 with a platform-split `auth` init (native `initializeAuth` + AsyncStorage persistence; web `getAuth`), mirroring the existing `region-store.ts` / `region-store.web.ts` convention. A React Context `AuthProvider` subscribes to `onAuthStateChanged`, reads custom claims via `getIdTokenResult`, loads the `users/{uid}` profile, and feeds the existing `useSession`/`useAccount` hooks (rewritten, same import paths, so no consumer churn). The root `_layout` guard decides routing from pure logic. Security rules are default-deny and claim-scoped. Dev runs against the Firebase emulators; Google is verified against the live project.

**Tech Stack:** Expo SDK 56 (dev client), React Native, expo-router (typed routes), Firebase JS SDK `^12`, `@react-native-async-storage/async-storage`, `@react-native-google-signin/google-signin`, `firebase-admin` (seed script, already in `functions/`), `@firebase/rules-unit-testing` (rules tests), Zod v4, react-hook-form, Jest (`jest-expo` preset) + `@testing-library/react-native`.

## Global Constraints

- **Firebase JS SDK only**, `firebase@>=12` (Expo requirement) — do NOT introduce React Native Firebase.
- App data lives in the **named `bike-eco-db`** database, not `(default)`. `db`/`storage`/`app` in `firebaseConfig.ts` are unchanged in behavior.
- `role` / `companyId` / `region` / account `status` are **server-set custom claims, never client-writable**. Security rules are **default-deny** and require auth.
- **UI copy is French.** Error messages must be specific and actionable ("Email ou mot de passe incorrect", not "Erreur").
- Forms use react-hook-form + Zod v4 via `zodResolver`, validate **on blur**, build fields with the `Controlled*` wrappers over `FormLayout`. Do NOT hand-roll form state.
- Style with `tokens` from `@/theme/tokens` — no style literals for colors/spacing.
- Import via the `@/*` alias (→ `src/*`); `firebaseConfig` is imported by relative path from `src/lib/firestore/collections.ts` and MUST keep exporting `app`, `db`, `storage` (plus new `auth`).
- Only `src/lib/firestore/collections.ts` imports `firebaseConfig` today — the platform split must not break that path.
- Jest runs under `jest-expo` (default native platform → resolves `firebaseConfig.ts`, not `.web.ts`). **Pure logic under test must NOT import `firebaseConfig`** so tests stay hermetic.
- Out of scope (later slices): dossier read listeners & removing `fixtures.ts` (Slice 2), dossier writes / `submitB2bSubmission` / Storage upload (Slice 3), registration Cloud Functions & `submit*Registration` / `invite` (Slice 4), Apple & Facebook providers.

---

## Manual setup you must perform (the agent cannot do these)

These require Firebase/Google console access, secret files, and a native rebuild on your machine. Do **Section A** before Task 2 (emulator dev), and **Section B/C** before Task 9 (Google).

### A. Firebase console — enable providers _(before Task 2)_
1. Firebase console → project **bike-eco-43a84** → **Authentication → Sign-in method**.
2. Enable **Email/Password**.
3. Enable **Google** (pick a support email). Leave it enabled — Task 9 uses it, verified live.

### B. Google OAuth config files & client IDs _(before Task 9)_
1. Firebase console → **Project settings → Your apps**. Ensure an **Android app** (`com.rnoyer.bikeeco`) and an **iOS app** (`com.rnoyer.bikeeco`) exist; create them if missing.
2. **Android:** add your debug + release **SHA-1** fingerprints (Project settings → Android app → "Add fingerprint"). Get debug SHA-1 with:
   ```sh
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
3. Download **`google-services.json`** (Android) → project root. Download **`GoogleService-Info.plist`** (iOS) → project root.
4. Collect the OAuth client IDs (Google Cloud console → **APIs & Services → Credentials**, or from the plist/json):
   - **Web client ID** (type "Web application") → used as `webClientId` on native AND as the Firebase provider audience. **Required.**
   - **iOS client ID** and its **reversed client ID** (the `com.googleusercontent.apps.…` value, in `GoogleService-Info.plist` as `REVERSED_CLIENT_ID`) → used as the `iosUrlScheme`.
5. Put the web client ID in an env var the app reads (Task 9 uses `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`). Add to your local `.env`:
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<web client id>.apps.googleusercontent.com
   ```
   For **web** Google sign-in, also add `<web client id>`'s authorized JavaScript origins for your dev host (e.g. `http://localhost:8081`) in Google Cloud console → Credentials.

### C. Dev-client rebuild for the Google native module _(after Task 9's code, before verifying Google on device)_
The google-signin native module links at build time. After Task 9 edits `app.json`:
```sh
npx expo prebuild --clean
npx expo run:ios      # or: npx expo run:android
```
Run this on a machine with Xcode / Android Studio configured (see Expo "Local app development"). Email/password sign-in and everything else in this slice work in the existing dev client **without** this rebuild — only Google needs it.

### D. Firebase CLI (used by emulators + rules tests + seed)
Confirm the CLI is available (the repo already uses it for functions):
```sh
npx -y firebase-tools@latest --version
```

---

## File map

**Create:**
- `firebase.core.ts` (root) — platform-neutral: `app`, `db`, `storage`, emulator flag/host helpers, Firestore+Storage emulator connect.
- `firebaseConfig.web.ts` (root) — web `auth` via `getAuth`, re-exports core.
- `src/lib/auth/authErrors.ts` — `mapAuthError(code)`; pure.
- `src/lib/auth/authErrors.test.ts`
- `src/lib/auth/session.ts` — `AuthClaims`, `SessionUser`, `buildSessionUser`; pure.
- `src/lib/auth/session.test.ts`
- `src/lib/auth/routeGuard.ts` — `AuthRoute`, `resolveAuthRoute`; pure.
- `src/lib/auth/routeGuard.test.ts`
- `src/lib/auth/AuthProvider.tsx` — context provider + `useAuth()`.
- `src/lib/auth/google.ts` — native Google sign-in.
- `src/lib/auth/google.web.ts` — web Google sign-in.
- `src/app/(auth)/pending.tsx` — "compte en attente de validation" screen.
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` (root).
- `src/lib/firestore/__tests__/rules.test.ts` — rules unit tests.
- `scripts/seed.ts` — Admin SDK emulator seed.

**Modify:**
- `firebaseConfig.ts` (root) — native `auth` via `initializeAuth` + persistence; re-export core.
- `firebase.json` — add `firestore`/`storage`/emulator sections.
- `src/lib/firestore/collections.ts` — export `WithId<T>` (relocated home).
- `src/lib/data/fixtures.ts` — re-export `WithId` from collections (keep existing importers working).
- `src/lib/data/useSession.ts` — rewrite to consume `AuthProvider`.
- `src/lib/data/useAccount.ts` — rewrite to consume `AuthProvider`.
- `src/app/_layout.tsx` — mount `AuthProvider`, apply the route guard + splash.
- `src/app/(auth)/signin.tsx` — wire email/password + forgot-password; remove DEV role-toggle; drop manual dashboard nav.
- `src/components/ui/ThirdPartyAuthButtons.tsx` — Google enabled, Apple/Facebook disabled.
- `src/components/screens/SettingsScreen.tsx`, `src/components/form/SettingsList.tsx`, `src/app/(b2b)/(tabs)/settings.tsx`, `src/app/(backoffice)/(tabs)/settings.tsx` — add sign-out.
- `app.json` — add google-signin config plugin.
- `package.json` — add `seed` npm script; new deps.

---

## Task 1: Platform-split Firebase Auth init + emulator wiring

**Files:**
- Create: `firebase.core.ts`, `firebaseConfig.web.ts`
- Modify: `firebaseConfig.ts`
- Test: `firebase.core.test.ts`

**Interfaces:**
- Consumes: existing `app`/`db`/`storage` config values.
- Produces: `auth` (Firebase `Auth`), `app`, `db`, `storage` exported from `firebaseConfig` (native) and `firebaseConfig.web` (web); `emulatorHost(os: string): string` and `USE_EMULATORS: boolean` from `firebase.core.ts`.

- [ ] **Step 1: Install AsyncStorage**

Run:
```sh
npx expo install @react-native-async-storage/async-storage
```
Expected: package added to `package.json` dependencies.

- [ ] **Step 2: Write the failing test for the emulator host resolver**

Create `firebase.core.test.ts`:
```ts
import { expect, test } from "@jest/globals";
import { emulatorHost } from "./firebase.core";

test("android emulator reaches the host via the 10.0.2.2 alias", () => {
  expect(emulatorHost("android")).toBe("10.0.2.2");
});

test("ios and web use localhost", () => {
  expect(emulatorHost("ios")).toBe("localhost");
  expect(emulatorHost("web")).toBe("localhost");
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx jest firebase.core.test.ts`
Expected: FAIL — `Cannot find module './firebase.core'`.

- [ ] **Step 4: Create `firebase.core.ts`**

```ts
import { Platform } from "react-native";
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyChXe-cQ1N3jMXI88vKMDlZj22Ep-PKjF4",
  authDomain: "bike-eco-43a84.firebaseapp.com",
  projectId: "bike-eco-43a84",
  storageBucket: "bike-eco-43a84.firebasestorage.app",
  messagingSenderId: "585450098034",
  appId: "1:585450098034:web:a460a8347bb5251d18a1eb",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** App data lives in the named `bike-eco-db` database, not `(default)`. */
export const db = getFirestore(app, "bike-eco-db");
export const storage = getStorage(app);

/** Dev opt-in: point every SDK at the local emulators. */
export const USE_EMULATORS =
  __DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS === "1";

/**
 * The Android emulator's `localhost` is its own loopback; `10.0.2.2` is its
 * alias for the host machine's 127.0.0.1. iOS sim and web share the host loopback.
 */
export function emulatorHost(os: string = Platform.OS): string {
  return os === "android" ? "10.0.2.2" : "localhost";
}

let connected = false;
/** Idempotently connect Firestore + Storage to the emulators (call once). */
export function connectDataEmulators() {
  if (!USE_EMULATORS || connected) return;
  connected = true;
  const host = emulatorHost();
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest firebase.core.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Rewrite `firebaseConfig.ts` (native) to add `auth`**

Replace the whole file with:
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  connectAuthEmulator,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";

import {
  app,
  connectDataEmulators,
  db,
  emulatorHost,
  storage,
  USE_EMULATORS,
} from "./firebase.core";

// React Native has no browser storage; persist the session via AsyncStorage so
// users stay signed in across reloads. `initializeAuth` (not `getAuth`) is
// required to inject the persistence layer on native.
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://${emulatorHost()}:9099`, {
    disableWarnings: true,
  });
  connectDataEmulators();
}

export { app, db, storage };
```

> If TypeScript reports `getReactNativePersistence` is not exported (a known
> firebase 12 typing gap), add a one-line module augmentation in a new
> `types/firebase-auth.d.ts` re-declaring it — do NOT change runtime behavior.

- [ ] **Step 7: Create `firebaseConfig.web.ts` (web) with browser-persisted `auth`**

```ts
import { connectAuthEmulator, getAuth } from "firebase/auth";

import {
  app,
  connectDataEmulators,
  db,
  emulatorHost,
  storage,
  USE_EMULATORS,
} from "./firebase.core";

// On web, `getAuth` uses browser local storage (IndexedDB) persistence by default.
export const auth = getAuth(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://${emulatorHost()}:9099`, {
    disableWarnings: true,
  });
  connectDataEmulators();
}

export { app, db, storage };
```

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`collections.ts` still imports `db` from `./firebaseConfig` — path unchanged.)

- [ ] **Step 9: Commit**

```sh
git add firebase.core.ts firebase.core.test.ts firebaseConfig.ts firebaseConfig.web.ts package.json package-lock.json
git commit -m "feat(auth): add platform-split Firebase Auth init + emulator wiring"
```

---

## Task 2: Security rules + emulator/rules config + rules tests

Activate the **firebase-firestore** and **firebase-security-rules-auditor** skills before writing rules; audit the final `firestore.rules` with the auditor skill.

**Files:**
- Create: `firestore.rules`, `storage.rules`, `firestore.indexes.json`, `src/lib/firestore/__tests__/rules.test.ts`
- Modify: `firebase.json`, `package.json`

**Interfaces:**
- Consumes: the `bike-eco-db` database name; claim shape `{ role, companyId, region, status }`.
- Produces: deployed-ready rules; a `test:rules` npm script.

- [ ] **Step 1: Add the emulator + rules sections to `firebase.json`**

Add these keys alongside the existing `functions`/`emulators` config (merge, don't replace `functions`):
```jsonc
{
  "firestore": {
    "database": "bike-eco-db",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": { "rules": "storage.rules" },
  "emulators": {
    "auth": { "port": 9099 },
    "functions": { "host": "0.0.0.0", "port": 5001 },
    "firestore": { "port": 8080 },
    "storage": { "port": 9199 },
    "ui": { "enabled": true },
    "singleProjectMode": true
  }
}
```

- [ ] **Step 2: Create `firestore.indexes.json` (empty to start)**

```json
{ "indexes": [], "fieldOverrides": [] }
```

- [ ] **Step 3: Create `storage.rules` (default-deny)**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Slice 3 opens dossier photo/attachment paths; everything is denied for now.
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 4: Create `firestore.rules` (default-deny, claim-scoped)**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function claims()      { return request.auth.token; }
    function isSignedIn()  { return request.auth != null; }
    function isBackoffice(){ return isSignedIn() && claims().role == 'backoffice'; }
    function isActive()    { return isSignedIn() && claims().status == 'active'; }
    function myCompany()   { return claims().companyId; }

    match /users/{uid} {
      allow read: if isSignedIn() && (request.auth.uid == uid || isBackoffice());
      // Owner edits profile fields only; role/companyId/region/status/createdAt
      // are server-set claims and must never be client-writable.
      allow update: if request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys()
             .hasAny(['role', 'companyId', 'region', 'status', 'createdAt']);
      allow create, delete: if false;
    }

    match /companies/{companyId} {
      allow read: if isBackoffice()
        || (isSignedIn() && myCompany() == companyId);
      allow write: if false;
    }

    match /dossiers/{dossierId} {
      allow read: if isBackoffice()
        || (isActive() && resource.data.companyId == myCompany());
      allow create, update, delete: if false;

      match /messages/{messageId} {
        allow read: if isBackoffice()
          || (isActive() && get(/databases/$(database)/documents/dossiers/$(dossierId))
                .data.companyId == myCompany());
        allow write: if false;
      }
    }

    match /invitations/{invitationId} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 5: Install the rules test harness + add scripts**

Run:
```sh
npm install --save-dev @firebase/rules-unit-testing
```
Add to `package.json` `scripts` (the wrapper boots the firestore emulator around the test):
```json
"test:rules": "firebase emulators:exec --only firestore --project bike-eco-43a84 \"jest --runTestsByPath src/lib/firestore/__tests__/rules.test.ts\""
```

- [ ] **Step 6: Write the rules tests**

Create `src/lib/firestore/__tests__/rules.test.ts`:
```ts
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
} from "@jest/globals";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

const b2bClaims = { role: "b2b", companyId: "comp_1", status: "active" };
const boClaims = { role: "backoffice", region: "NORTH", status: "active" };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "bike-eco-43a84",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"),
    },
  });
  // Seed docs bypassing rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "dossiers/dos_1"), { companyId: "comp_1" });
    await setDoc(doc(db, "dossiers/dos_2"), { companyId: "comp_2" });
    await setDoc(doc(db, "users/user_b2b"), { nom: "Durand" });
  });
});

afterAll(async () => env.cleanup());

test("unauthenticated reads are denied", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "dossiers/dos_1")));
});

test("a b2b user reads only their company's dossiers", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "dossiers/dos_1")));
  await assertFails(getDoc(doc(db, "dossiers/dos_2")));
});

test("backoffice reads any dossier", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "dossiers/dos_2")));
});

test("owner cannot escalate their own claims fields", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertSucceeds(updateDoc(doc(db, "users/user_b2b"), { ville: "Lyon" }));
  await assertFails(updateDoc(doc(db, "users/user_b2b"), { role: "backoffice" }));
});
```

- [ ] **Step 7: Run the rules tests**

Run: `npm run test:rules`
Expected: PASS (4 tests). The emulator boots, runs, and tears down.
> If the emulator can't bind the named `bike-eco-db` for unit-testing, the rules
> logic is database-agnostic — tests use the emulator's default instance; the
> `firebase.json` `firestore.database` binds the same rules file to `bike-eco-db`
> at deploy. Verify the deploy binding in Step 8.

- [ ] **Step 8: Validate the deploy binding (dry run, no deploy)**

Run: `npx -y firebase-tools@latest deploy --only firestore:rules --project bike-eco-43a84 --dry-run`
Expected: reports the rules compile and target the `bike-eco-db` database. (Do NOT deploy for real in this task.)

- [ ] **Step 9: Commit**

```sh
git add firebase.json firestore.rules storage.rules firestore.indexes.json src/lib/firestore/__tests__/rules.test.ts package.json package-lock.json
git commit -m "feat(security): default-deny claim-scoped Firestore + Storage rules with emulator tests"
```

---

## Task 3: Admin SDK seed script

**Files:**
- Create: `scripts/seed.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `firebase-admin` (already in `functions/node_modules`; add as a root devDependency for standalone run). The `AppUser`/`Company`/`Dossier` shapes from `src/lib/firestore/schema.ts`.
- Produces: `npm run seed` → creates auth users with claims + matching Firestore docs against the emulators.

- [ ] **Step 1: Add firebase-admin + ts runner devDeps and a script**

Run:
```sh
npm install --save-dev firebase-admin tsx
```
Add to `package.json` `scripts`:
```json
"seed": "FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 tsx scripts/seed.ts"
```

- [ ] **Step 2: Write `scripts/seed.ts`**

```ts
/**
 * Idempotently seeds the Auth + Firestore emulators with test identities and
 * data so both roles and the pending-gate are previewable without registration
 * (Slice 4). Run with `npm run seed` while the emulators are running.
 */
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "bike-eco-43a84";
const DB_ID = "bike-eco-db";

if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore(DB_ID);

type Claims = Record<string, unknown>;

async function upsertUser(
  uid: string,
  email: string,
  password: string,
  claims: Claims,
) {
  try {
    await auth.updateUser(uid, { email, password });
  } catch {
    await auth.createUser({ uid, email, password });
  }
  await auth.setCustomUserClaims(uid, claims);
}

async function main() {
  const now = Timestamp.now();

  await db.doc(`companies/comp_nord`).set({
    siret: "12345678900011",
    name: "Garage du Nord",
    status: "active",
    createdBy: "user_b2b",
    createdAt: now,
  });

  await upsertUser("user_b2b", "b2b@garage-nord.fr", "password123", {
    role: "b2b",
    companyId: "comp_nord",
    status: "active",
  });
  await db.doc(`users/user_b2b`).set({
    role: "b2b", companyId: "comp_nord", region: null,
    nom: "Durand", prenom: "Camille", email: "b2b@garage-nord.fr",
    telephone: "0601020304", departement: "75 - Paris", ville: "Paris",
    status: "active", createdAt: now, updatedAt: now,
  });

  await upsertUser("user_bo", "bo@bike-eco.fr", "password123", {
    role: "backoffice",
    companyId: null,
    region: "NORTH",
    status: "active",
  });
  await db.doc(`users/user_bo`).set({
    role: "backoffice", companyId: null, region: "NORTH",
    nom: "Martin", prenom: "Alex", email: "bo@bike-eco.fr",
    telephone: "0605060708", departement: "45 - Loiret", ville: "Montargis",
    status: "active", createdAt: now, updatedAt: now,
  });

  await upsertUser("user_pending", "pending@garage-nord.fr", "password123", {
    role: "b2b",
    companyId: "comp_nord",
    status: "pending",
  });
  await db.doc(`users/user_pending`).set({
    role: "b2b", companyId: "comp_nord", region: null,
    nom: "Petit", prenom: "Sam", email: "pending@garage-nord.fr",
    telephone: "0611121314", departement: "75 - Paris", ville: "Paris",
    status: "pending", createdAt: now, updatedAt: now,
  });

  for (const [id, region, marque, modele, status] of [
    ["dos_1", "NORTH", "Yamaha", "MT-07", "a_traiter"],
    ["dos_2", "SOUTH", "Kawasaki", "Z650", "en_cours"],
  ] as const) {
    await db.doc(`dossiers/${id}`).set({
      status, region, companyId: "comp_nord", submittedBy: "user_b2b",
      assignedTo: null, negotiatedPrice: null,
      submitter: { nom: "Durand", prenom: "Camille", companyName: "Garage du Nord" },
      vehicle: {
        electrique: "non", materiel: [], marque, modele,
        cylindree: 689, annee: 2019, kilometrage: 18450, accessoires: "",
      },
      keys: { aClesContact: "oui", cleNoire: 2, cleMarron: 0, cleRouge: 0, aTelecommande: "non", telecommande: null },
      condition: { etat: "Bon état", naturePanne: "" },
      papers: {
        carteGrise: "oui", carteGriseAVotreNom: "oui", controleTechnique: "oui",
        ctMoins6Mois: "oui", resultatCT: "Favorable", certificatNonGage: "oui",
        carnetEntretien: "oui", factureEntretien: "non",
      },
      pricing: { prix: 5000, commentaires: "" },
      photos: [], thumbnailUrl: null,
      createdAt: now, updatedAt: now, lastMessageAt: null,
    });
  }

  console.log("Seed complete: user_b2b / user_bo / user_pending (password123).");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the emulators, then seed**

Run (terminal 1): `npx -y firebase-tools@latest emulators:start --only auth,firestore --project bike-eco-43a84`
Run (terminal 2): `npm run seed`
Expected: "Seed complete: user_b2b / user_bo / user_pending (password123)." in terminal 2; users + docs visible in the Emulator UI.

- [ ] **Step 4: Verify idempotency**

Run `npm run seed` a second time.
Expected: same success output, no "already exists" crash.

- [ ] **Step 5: Commit**

```sh
git add scripts/seed.ts package.json package-lock.json
git commit -m "feat(dev): Admin SDK emulator seed for b2b/backoffice/pending users"
```

---

## Task 4: `mapAuthError` — French auth error copy (TDD)

**Files:**
- Create: `src/lib/auth/authErrors.ts`, `src/lib/auth/authErrors.test.ts`

**Interfaces:**
- Produces: `mapAuthError(code: string): string` — maps a Firebase Auth error code to French user copy. Consumed by Task 7 (sign-in) and Task 9 (Google).

- [ ] **Step 1: Write the failing test**

`src/lib/auth/authErrors.test.ts`:
```ts
import { expect, test } from "@jest/globals";
import { mapAuthError } from "./authErrors";

test("bad credentials map to a specific message", () => {
  expect(mapAuthError("auth/invalid-credential")).toBe(
    "Email ou mot de passe incorrect.",
  );
  expect(mapAuthError("auth/wrong-password")).toBe(
    "Email ou mot de passe incorrect.",
  );
});

test("rate limiting and network have their own copy", () => {
  expect(mapAuthError("auth/too-many-requests")).toBe(
    "Trop de tentatives. Réessayez plus tard.",
  );
  expect(mapAuthError("auth/network-request-failed")).toBe(
    "Connexion impossible. Vérifiez votre réseau.",
  );
});

test("unknown codes fall back to a generic French message", () => {
  expect(mapAuthError("auth/internal-error")).toBe(
    "La connexion a échoué. Veuillez réessayer.",
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/lib/auth/authErrors.test.ts`
Expected: FAIL — cannot find `./authErrors`.

- [ ] **Step 3: Implement `authErrors.ts`**

```ts
const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/wrong-password": "Email ou mot de passe incorrect.",
  "auth/user-not-found": "Email ou mot de passe incorrect.",
  "auth/invalid-email": "Saisissez un email valide.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez plus tard.",
  "auth/network-request-failed": "Connexion impossible. Vérifiez votre réseau.",
};

/** Map a Firebase Auth error code to specific, actionable French copy. */
export function mapAuthError(code: string): string {
  return MESSAGES[code] ?? "La connexion a échoué. Veuillez réessayer.";
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/lib/auth/authErrors.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```sh
git add src/lib/auth/authErrors.ts src/lib/auth/authErrors.test.ts
git commit -m "feat(auth): mapAuthError French error copy"
```

---

## Task 5: Session assembly + AuthProvider + rewire hooks

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/auth/session.test.ts`, `src/lib/auth/AuthProvider.tsx`
- Modify: `src/lib/firestore/collections.ts`, `src/lib/data/fixtures.ts`, `src/lib/data/useSession.ts`, `src/lib/data/useAccount.ts`, `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `AppUser` (schema), `auth`/`db` from `firebaseConfig`, `userDoc` from `collections`.
- Produces:
  - `WithId<T>` exported from `src/lib/firestore/collections.ts`.
  - `AuthClaims = { role: UserRole; companyId: string | null; region: Region | null; status: UserStatus }` and `SessionUser = WithId<AppUser>` from `session.ts`.
  - `buildSessionUser(uid: string, claims: AuthClaims, profile: AppUser): SessionUser`.
  - `AuthProvider` component + `useAuth(): { firebaseUser, session: SessionUser | null, status: UserStatus | null, loading: boolean, signOut: () => Promise<void> }`.
  - Rewritten `useSession(): { user: SessionUser | null; role: UserRole | null; status: UserStatus | null; loading: boolean; signOut: () => Promise<void> }` (same import path `@/lib/data/useSession`).
  - Rewritten `useAccount(): { data: SessionUser | null; loading: boolean }`.

- [ ] **Step 1: Relocate `WithId` into `collections.ts`**

In `src/lib/firestore/collections.ts`, add near the top exports:
```ts
/** A Firestore document paired with its id (docs don't carry their own id). */
export type WithId<T> = T & { id: string };
```
In `src/lib/data/fixtures.ts`, replace the local `export type WithId<T> = T & { id: string };` with a re-export so existing importers keep working:
```ts
export type { WithId } from "@/lib/firestore/collections";
```

- [ ] **Step 2: Write the failing test for `buildSessionUser`**

`src/lib/auth/session.test.ts`:
```ts
import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import { buildSessionUser } from "./session";
import type { AppUser } from "@/lib/firestore/schema";

const profile: AppUser = {
  role: "b2b", companyId: "comp_1", region: null,
  nom: "Durand", prenom: "Camille", email: "c@x.fr",
  telephone: "0600000000", departement: "75 - Paris", ville: "Paris",
  status: "active", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
};

test("merges uid + claims + profile, with claims authoritative for role/status", () => {
  const user = buildSessionUser("uid_1",
    { role: "b2b", companyId: "comp_1", region: null, status: "active" },
    { ...profile, role: "backoffice", status: "pending" }, // stale profile
  );
  expect(user.id).toBe("uid_1");
  expect(user.role).toBe("b2b");     // from claims, not the stale profile
  expect(user.status).toBe("active"); // from claims
  expect(user.nom).toBe("Durand");   // from profile
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx jest src/lib/auth/session.test.ts`
Expected: FAIL — cannot find `./session`.

- [ ] **Step 4: Implement `session.ts`**

```ts
import type { AppUser, Region, UserRole, UserStatus } from "@/lib/firestore/schema";
import type { WithId } from "@/lib/firestore/collections";

export interface AuthClaims {
  role: UserRole;
  companyId: string | null;
  region: Region | null;
  status: UserStatus;
}

export type SessionUser = WithId<AppUser>;

/**
 * Assemble the session identity. Custom claims are the source of truth for the
 * privileged fields (role/companyId/region/status); the `users` doc supplies the
 * editable profile. Claims win so a stale profile can't grant the wrong access.
 */
export function buildSessionUser(
  uid: string,
  claims: AuthClaims,
  profile: AppUser,
): SessionUser {
  return {
    ...profile,
    id: uid,
    role: claims.role,
    companyId: claims.companyId,
    region: claims.region,
    status: claims.status,
  };
}

/** Narrow a raw Firebase ID-token claims bag to our typed shape. */
export function parseClaims(raw: Record<string, unknown>): AuthClaims {
  return {
    role: (raw.role as UserRole) ?? "b2b",
    companyId: (raw.companyId as string | null) ?? null,
    region: (raw.region as Region | null) ?? null,
    status: (raw.status as UserStatus) ?? "pending",
  };
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx jest src/lib/auth/session.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement `AuthProvider.tsx`**

```tsx
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";

import { auth } from "../../../firebaseConfig";
import { userDoc } from "@/lib/firestore/collections";
import type { AppUser, UserStatus } from "@/lib/firestore/schema";
import { buildSessionUser, parseClaims, type SessionUser } from "./session";

interface AuthState {
  firebaseUser: User | null;
  session: SessionUser | null;
  status: UserStatus | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setSession(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const [token, snap] = await Promise.all([
        user.getIdTokenResult(true),
        getDoc(userDoc(user.uid)),
      ]);
      const claims = parseClaims(token.claims as Record<string, unknown>);
      const profile = (snap.data() as AppUser | undefined) ?? null;
      setSession(profile ? buildSessionUser(user.uid, claims, profile) : null);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      session,
      status: session?.status ?? null,
      loading,
      signOut: () => fbSignOut(auth),
    }),
    [firebaseUser, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
```

- [ ] **Step 7: Rewrite `useSession.ts` to consume the provider**

Replace the whole file:
```ts
import { useAuth } from "@/lib/auth/AuthProvider";

/** Real session, backed by Firebase Auth custom claims + the users/{uid} doc. */
export function useSession() {
  const { session, status, loading, signOut } = useAuth();
  return {
    user: session,
    role: session?.role ?? null,
    status,
    loading,
    signOut,
  };
}
```

- [ ] **Step 8: Rewrite `useAccount.ts`**

Replace the whole file:
```ts
import { useAuth } from "@/lib/auth/AuthProvider";
import type { SessionUser } from "@/lib/auth/session";

export function useAccount(): { data: SessionUser | null; loading: boolean } {
  const { session, loading } = useAuth();
  return { data: session, loading };
}
```

- [ ] **Step 9: Guard the two `user`-consuming screens against null**

`AccountScreen.tsx` and `DossierChatScreen.tsx` now receive `user`/`data` that can be `null` while loading. In `AccountScreen.tsx`:
```tsx
export default function AccountScreen() {
  const { data, loading } = useAccount();
  if (loading || !data) return null; // guard shows briefly; layout splash covers first paint
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <AccountInfoList user={data} />
    </ScrollView>
  );
}
```
In `DossierChatScreen.tsx`, replace `const { user } = useSession();` usage so a null `user` is handled: gate the composer/send on `user` being present (e.g. `if (!user) return null;` at the top, matching the file's existing early-return style).

- [ ] **Step 10: Mount `AuthProvider` in the root layout**

In `src/app/_layout.tsx`, wrap the stack (guard logic is added in Task 6; here just provide context):
```tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "@/lib/auth/AuthProvider";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 11: Typecheck, lint, run the unit tests**

Run: `npx tsc --noEmit && npm run lint && npx jest src/lib/auth`
Expected: no type/lint errors; auth unit tests pass.

- [ ] **Step 12: Commit**

```sh
git add src/lib/auth src/lib/firestore/collections.ts src/lib/data/fixtures.ts src/lib/data/useSession.ts src/lib/data/useAccount.ts src/app/_layout.tsx src/components/screens/AccountScreen.tsx src/components/screens/DossierChatScreen.tsx
git commit -m "feat(auth): claims-backed AuthProvider + session hooks"
```

---

## Task 6: Route guard (TDD) + pending screen

**Files:**
- Create: `src/lib/auth/routeGuard.ts`, `src/lib/auth/routeGuard.test.ts`, `src/app/(auth)/pending.tsx`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `useAuth()` from Task 5; `useSegments`/`router` from expo-router.
- Produces: `resolveAuthRoute(state): AuthRoute` where `AuthRoute = "loading" | "signin" | "pending" | "b2b" | "backoffice"`.

- [ ] **Step 1: Write the failing test**

`src/lib/auth/routeGuard.test.ts`:
```ts
import { expect, test } from "@jest/globals";
import { resolveAuthRoute } from "./routeGuard";

test("loading wins over everything", () => {
  expect(resolveAuthRoute({ loading: true, role: null, status: null })).toBe("loading");
});

test("no session routes to signin", () => {
  expect(resolveAuthRoute({ loading: false, role: null, status: null })).toBe("signin");
});

test("non-active status is blocked at the pending screen", () => {
  expect(resolveAuthRoute({ loading: false, role: "b2b", status: "pending" })).toBe("pending");
});

test("active users route by role", () => {
  expect(resolveAuthRoute({ loading: false, role: "b2b", status: "active" })).toBe("b2b");
  expect(resolveAuthRoute({ loading: false, role: "backoffice", status: "active" })).toBe("backoffice");
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/lib/auth/routeGuard.test.ts`
Expected: FAIL — cannot find `./routeGuard`.

- [ ] **Step 3: Implement `routeGuard.ts`**

```ts
import type { UserRole, UserStatus } from "@/lib/firestore/schema";

export type AuthRoute = "loading" | "signin" | "pending" | "b2b" | "backoffice";

/** Pure decision: given auth state, where should the user be? */
export function resolveAuthRoute(state: {
  loading: boolean;
  role: UserRole | null;
  status: UserStatus | null;
}): AuthRoute {
  if (state.loading) return "loading";
  if (!state.role) return "signin";
  if (state.status !== "active") return "pending";
  return state.role === "backoffice" ? "backoffice" : "b2b";
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/lib/auth/routeGuard.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Create the pending screen**

`src/app/(auth)/pending.tsx`:
```tsx
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Button from "@/components/ui/Button";
import PhotoBackground from "@/components/ui/PhotoBackground";
import { useSession } from "@/lib/data/useSession";
import { tokens } from "@/theme/tokens";

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();
  return (
    <PhotoBackground>
      <View style={[styles.center, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.card}>
          <Text style={styles.title}>Compte en attente de validation</Text>
          <Text style={styles.body}>
            Votre inscription a bien été reçue. Un membre de l’équipe Bike-eco doit
            valider votre compte avant que vous puissiez accéder à votre tableau de bord.
          </Text>
          <Button label="Se déconnecter" variant="outlined" onPress={signOut} />
        </View>
      </View>
    </PhotoBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: tokens.space.lg },
  card: {
    width: "100%", maxWidth: 420, gap: tokens.space.md, padding: tokens.space.lg,
    borderRadius: tokens.radius.lg, backgroundColor: tokens.colors.surface,
  },
  title: { ...tokens.text.title, textAlign: "center" },
  body: { fontSize: 14, color: tokens.colors.muted, textAlign: "center", lineHeight: 20 },
});
```

- [ ] **Step 6: Apply the guard in the root layout**

Update `src/app/_layout.tsx` to redirect from a component nested inside `AuthProvider` (hooks need the context). The public B2C funnel (`index`, `b2cSubmissionForm`) stays reachable while signed out.
```tsx
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth/AuthProvider";
import { resolveAuthRoute } from "@/lib/auth/routeGuard";

const PUBLIC_SEGMENTS = new Set(["index", "b2cSubmissionForm"]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, session, status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const route = resolveAuthRoute({ loading, role: session?.role ?? null, status });
    const top = segments[0] ?? "index";
    const inAuthGroup = top === "(auth)";
    const isPublic = PUBLIC_SEGMENTS.has(top);

    if (route === "signin") {
      if (!inAuthGroup && !isPublic) router.replace("/(auth)/signin");
    } else if (route === "pending") {
      router.replace("/(auth)/pending");
    } else if (route === "b2b") {
      if (inAuthGroup) router.replace("/(b2b)/(tabs)/dashboard");
    } else if (route === "backoffice") {
      if (inAuthGroup) router.replace("/(backoffice)/(tabs)/dashboard");
    }
  }, [loading, session, status, segments, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 7: Typecheck, lint, unit tests**

Run: `npx tsc --noEmit && npm run lint && npx jest src/lib/auth`
Expected: green.

- [ ] **Step 8: Commit**

```sh
git add src/lib/auth/routeGuard.ts src/lib/auth/routeGuard.test.ts "src/app/(auth)/pending.tsx" src/app/_layout.tsx
git commit -m "feat(auth): route guard + pending-account gate"
```

---

## Task 7: Wire email/password sign-in + forgot password

**Files:**
- Modify: `src/app/(auth)/signin.tsx`

**Interfaces:**
- Consumes: `auth` from `firebaseConfig`; `mapAuthError` (Task 4); `SignInFields` (unchanged `onSubmit(email, password)` / `onForgotPassword` props).
- Produces: functioning email/password sign-in. Navigation is handled by the Task 6 guard (no manual dashboard push).

- [ ] **Step 1: Rewrite `signin.tsx`**

Remove the DEV role-toggle and the `DASHBOARDS`/`goToDashboard` manual nav; add real sign-in with an inline error and forgot-password. Keep the `PhotoBackground`/card layout and `ThirdPartyAuthButtons` slot (Task 9 wires Google).
```tsx
import { useRouter } from "expo-router";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { auth } from "../../../firebaseConfig";
import SignInFields from "@/components/form/SignInFields";
import PhotoBackground from "@/components/ui/PhotoBackground";
import ThirdPartyAuthButtons from "@/components/ui/ThirdPartyAuthButtons";
import { mapAuthError } from "@/lib/auth/authErrors";
import { tokens } from "@/theme/tokens";

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSignIn = async (email: string, password: string) => {
    setError(null);
    setNotice(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // The root AuthGate redirects on the resulting auth-state change.
    } catch (e) {
      setError(mapAuthError((e as { code?: string }).code ?? ""));
    }
  };

  const handleForgot = async (email: string) => {
    setError(null);
    if (!email) {
      setError("Saisissez d’abord votre email pour réinitialiser le mot de passe.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setNotice("Email de réinitialisation envoyé. Vérifiez votre boîte de réception.");
    } catch (e) {
      setError(mapAuthError((e as { code?: string }).code ?? ""));
    }
  };

  return (
    <PhotoBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Bienvenue !</Text>
          <SignInFields onSubmit={handleSignIn} onForgotPassword={handleForgot} />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {/* Interim no-op; Google is wired into this call site in Task 9. */}
          <ThirdPartyAuthButtons onPress={() => {}} />
          <Text
            style={styles.registerLink}
            onPress={() => router.push("/(auth)/register")}
          >
            Pas encore de compte ? Créer un compte
          </Text>
        </View>
      </ScrollView>
    </PhotoBackground>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", paddingHorizontal: tokens.space.lg },
  card: {
    gap: tokens.space.lg, padding: tokens.space.lg, borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 6 },
    }),
  },
  title: { ...tokens.text.title, textAlign: "center" },
  error: { fontSize: 14, color: tokens.colors.danger, textAlign: "center" },
  notice: { fontSize: 14, color: tokens.colors.primary, textAlign: "center" },
  registerLink: {
    fontSize: 14, color: tokens.colors.primary, textAlign: "center",
    textDecorationLine: "underline",
  },
});
```

> `SignInFields.onForgotPassword` currently takes no args — it's updated to accept
> the email in Step 2 below. (`tokens.colors.danger` = `#DC2626` is confirmed present.)

- [ ] **Step 2: Update `SignInFields.tsx` forgot-password signature**

In `src/components/form/SignInFields.tsx`:
- Change the prop: `onForgotPassword: (email: string) => void;`
- Change the button: `onPress={() => onForgotPassword(form.getValues("email"))}`

- [ ] **Step 3: Verify against the emulators (manual, scripted check)**

Start emulators + seed (Task 3 Step 3), then run the app pointed at emulators:
```sh
EXPO_PUBLIC_USE_EMULATORS=1 npx expo start
```
- Sign in as `b2b@garage-nord.fr` / `password123` → lands on the B2B dashboard.
- Sign in as `pending@garage-nord.fr` → blocked on the pending screen.
- Sign in as `bo@bike-eco.fr` → back-office dashboard.
- Wrong password → "Email ou mot de passe incorrect."
Expected: all four behaviors observed.

- [ ] **Step 4: Typecheck + lint + commit**

```sh
npx tsc --noEmit && npm run lint
git add "src/app/(auth)/signin.tsx" src/components/form/SignInFields.tsx
git commit -m "feat(auth): wire email/password sign-in + password reset"
```

---

## Task 8: Sign-out in settings

**Files:**
- Modify: `src/components/form/SettingsList.tsx`, `src/components/screens/SettingsScreen.tsx`, `src/app/(b2b)/(tabs)/settings.tsx`, `src/app/(backoffice)/(tabs)/settings.tsx`

**Interfaces:**
- Consumes: `useSession().signOut` (Task 5).
- Produces: a "Se déconnecter" action; the guard returns the user to sign-in on sign-out.

- [ ] **Step 1: Add `onSignOut` to `SettingsList`**

In `src/components/form/SettingsList.tsx`, add `onSignOut: () => void` to `Props` and render it as the last button:
```tsx
<Button variant="text" label="Se déconnecter" onPress={onSignOut} />
```

- [ ] **Step 2: Thread it through `SettingsScreen`**

In `src/components/screens/SettingsScreen.tsx`, add `onSignOut: () => void` to `Props` and pass it into `<SettingsList … onSignOut={onSignOut} />`.

- [ ] **Step 3: Wire both settings routes**

In `src/app/(b2b)/(tabs)/settings.tsx` and `src/app/(backoffice)/(tabs)/settings.tsx`, pull `signOut` from `useSession` and pass `onSignOut={signOut}`:
```tsx
import { useSession } from "@/lib/data/useSession";
// …
const { signOut } = useSession();
// …
<SettingsScreen role="b2b" onInvite={…} onDelete={…} onSignOut={signOut} />
```

- [ ] **Step 4: Verify**

With emulators running, sign in, open Settings, tap "Se déconnecter".
Expected: returns to the sign-in screen (guard redirect).

- [ ] **Step 5: Typecheck + lint + commit**

```sh
npx tsc --noEmit && npm run lint
git add src/components/form/SettingsList.tsx src/components/screens/SettingsScreen.tsx "src/app/(b2b)/(tabs)/settings.tsx" "src/app/(backoffice)/(tabs)/settings.tsx"
git commit -m "feat(auth): sign-out from settings"
```

---

## Task 9: Google sign-in (native + web)

**Prerequisite:** Manual setup Sections **B** and **C** above.

**Files:**
- Create: `src/lib/auth/google.ts`, `src/lib/auth/google.web.ts`
- Modify: `src/components/ui/ThirdPartyAuthButtons.tsx`, `src/app/(auth)/signin.tsx` (swap the interim `onPress={() => {}}` to `onError={setError}`), `app.json`, `package.json`

**Interfaces:**
- Consumes: `auth` from `firebaseConfig`; `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- Produces: `signInWithGoogle(): Promise<void>` (platform-split). `ThirdPartyAuthButtons` prop becomes `{ onError: (msg: string) => void }`; Google enabled, Apple/Facebook disabled.

- [ ] **Step 1: Install the native module**

Run:
```sh
npx expo install @react-native-google-signin/google-signin
```

- [ ] **Step 2: Add the config plugin to `app.json`**

In `expo.plugins`, add:
```json
[
  "@react-native-google-signin/google-signin",
  { "iosUrlScheme": "com.googleusercontent.apps.REPLACE_WITH_REVERSED_CLIENT_ID" }
]
```
Also add, at the `expo.ios` / `expo.android` level:
```json
"ios": { "googleServicesFile": "./GoogleService-Info.plist", "bundleIdentifier": "com.rnoyer.bikeeco" },
"android": { "googleServicesFile": "./google-services.json", "package": "com.rnoyer.bikeeco", … }
```
(Keep the existing icon config; only add the `googleServicesFile` keys.)

- [ ] **Step 3: Implement native `google.ts`**

```ts
import {
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { auth } from "../../../firebaseConfig";

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
});

/** Native Google sign-in → Firebase credential. Throws on cancel/failure. */
export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  await GoogleSignin.signIn();
  const { idToken } = await GoogleSignin.getTokens();
  if (!idToken) throw new Error("google/no-id-token");
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export { statusCodes };
```

- [ ] **Step 4: Implement web `google.web.ts`**

```ts
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../../../firebaseConfig";

/** Web Google sign-in via popup. */
export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, new GoogleAuthProvider());
}
```

- [ ] **Step 5: Rewrite `ThirdPartyAuthButtons.tsx`**

Google enabled; Apple/Facebook disabled with "bientôt disponible".
```tsx
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { signInWithGoogle } from "@/lib/auth/google";
import { mapAuthError } from "@/lib/auth/authErrors";
import { tokens } from "@/theme/tokens";

export default function ThirdPartyAuthButtons({
  onError,
}: {
  onError: (message: string) => void;
}) {
  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      const code = (e as { code?: string }).code;
      // User-cancelled flows are silent.
      if (code === "-5" || code === "auth/popup-closed-by-user") return;
      onError(mapAuthError(code ?? ""));
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.or}>Ou continuez avec</Text>
        <View style={styles.line} />
      </View>
      <TouchableOpacity style={styles.btn} onPress={handleGoogle} activeOpacity={0.7}>
        <Text style={styles.btnText}>Google</Text>
      </TouchableOpacity>
      {(["Apple", "Facebook"] as const).map((label) => (
        <TouchableOpacity
          key={label}
          style={[styles.btn, styles.btnDisabled]}
          disabled
          accessibilityState={{ disabled: true }}
        >
          <Text style={[styles.btnText, styles.btnTextDisabled]}>
            {label} — bientôt disponible
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.md },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: tokens.space.md },
  line: { flex: 1, height: 1, backgroundColor: tokens.colors.border },
  or: { fontSize: 13, color: tokens.colors.muted },
  btn: {
    height: tokens.button.height, borderRadius: tokens.radius.md, borderWidth: 1.5,
    borderColor: tokens.colors.border, alignItems: "center", justifyContent: "center",
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "600", color: tokens.colors.primary },
  btnTextDisabled: { color: tokens.colors.muted },
});
```

- [ ] **Step 5b: Swap the sign-in call site to `onError`**

In `src/app/(auth)/signin.tsx`, replace the interim
`<ThirdPartyAuthButtons onPress={() => {}} />` with `<ThirdPartyAuthButtons onError={setError} />`
(`setError` already exists from Task 7). Run `npx tsc --noEmit` to confirm the prop contract lines up.

- [ ] **Step 6: Rebuild the dev client (Manual setup Section C)**

Run: `npx expo prebuild --clean` then `npx expo run:ios` (or `run:android`).
Expected: app builds with the Google native module linked.

- [ ] **Step 7: Verify Google against the LIVE project (Decision 5)**

Run WITHOUT the emulator flag so auth hits live: `npx expo start` (dev client).
- Tap "Google" → complete the Google account picker → signs in.
- Note: a brand-new Google user has no `users/{uid}` doc/claims yet, so the guard routes them to the pending screen (expected until registration/Slice 4). Verify with a Google account you have pre-provisioned via the seed/console, or simply confirm sign-in succeeds and lands on pending.
Expected: Firebase Auth shows the Google user; no crash.

- [ ] **Step 8: Typecheck + lint + commit**

```sh
npx tsc --noEmit && npm run lint
git add src/lib/auth/google.ts src/lib/auth/google.web.ts src/components/ui/ThirdPartyAuthButtons.tsx "src/app/(auth)/signin.tsx" app.json package.json package-lock.json
git commit -m "feat(auth): Google sign-in (native + web), Apple/Facebook deferred"
```

---

## Final verification (whole slice)

- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run lint` — clean.
- [ ] `npx jest` — all unit tests pass (authErrors, session, routeGuard, firebase.core, plus existing suites).
- [ ] `npm run test:rules` — rules tests pass.
- [ ] Emulator walkthrough: seed → sign in as each of the three seeded users → correct routing (b2b dashboard / backoffice dashboard / pending gate); wrong password shows French error; sign-out returns to sign-in; account screen shows the real Firestore profile.
- [ ] Live: Google sign-in succeeds on a device dev-client build.

## Self-review notes (author)

- **Spec coverage:** Section 1 → Task 1; Section 2 (provider/claims/hooks) → Task 5; Section 3 (sign-in/out, Google, forgot) → Tasks 7–9; Section 4 (guard/pending) → Task 6; Section 5 (rules/emulator/seed) → Tasks 2–3. All Decisions 1–5 mapped.
- **Deferred** items are fenced in Global Constraints and touched by no task.
- **Type consistency:** `SessionUser`/`AuthClaims`/`buildSessionUser`/`parseClaims` (Task 5), `resolveAuthRoute`/`AuthRoute` (Task 6), `mapAuthError` (Task 4), `signInWithGoogle` (Task 9) are used with the same signatures where referenced.
- **Verified against the codebase:** `tokens.colors.danger`/`tokens.button.height` and Button variants (`primary`/`outlined`/`text`) all exist. `firebaseConfig` is imported only by `collections.ts` (relative path preserved by the split).
- **Open verification risk:** rules-unit-testing against the named `bike-eco-db` (Task 2 Step 7 note) is flagged inline for the implementer to confirm at run time.
