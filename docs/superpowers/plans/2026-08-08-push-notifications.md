# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver iOS + Android push notifications for the five business events (new company, new dossier, new chat message, status change, prix-validé change), with a per-dossier mute toggle.

**Architecture:** Firestore triggers in `functions/` resolve recipients and send through `firebase-admin` messaging. The client uses `@react-native-firebase/messaging` for the FCM token, message receipt and tap routing, and `expo-notifications` for the permission prompt, the Android channel and foreground presentation. Recipient resolution and every French string are pure, dependency-injected functions with unit tests; the Firestore/admin wiring around them is gated by `tsc` + lint, matching the house style.

**Tech Stack:** Expo SDK 56 / React Native 0.85, expo-router (typed routes), Firebase JS SDK v12 (auth + Firestore), `@react-native-firebase/app` + `@react-native-firebase/messaging` 26.1.0, `expo-notifications`, Cloud Functions v2 (`firebase-functions` ^7.3.2, `firebase-admin` ^13.6.0), Zod 4, Jest.

**Spec:** `docs/superpowers/specs/2026-08-08-push-notifications-design.md`

## Global Constraints

- App data lives in the **named `bike-eco-db`** database. Every Firestore trigger MUST pass `database: "bike-eco-db"`. Without it the trigger binds to `(default)` and silently never fires.
- Every trigger runs with **`retry: false`**. A duplicate push is worse than a missed one.
- Notification failures are **logged, never surfaced in the UI**.
- People render as **prénom nom** everywhere.
- All user-facing copy is **French**, exactly as written in the tables in this plan. Do not paraphrase, do not "fix" the grammar of `"Une nouvelle proposition d'achat vient d'être publié."` — it is the spec's string.
- Moto label helper is exactly: `[marque, modele].filter(Boolean).join(" ") || "Moto non renseignée"`.
- Web is a **no-op** for everything notification-related, via the `.web.ts` sibling pattern already used by `googleSignIn.web.ts`.
- The gate for every task is `npx tsc --noEmit && npx expo lint && npm test` from the repo root. Tasks touching `functions/` additionally run `cd functions && npx tsc --noEmit && npm test`. Tasks touching `firestore.rules` additionally run `JAVA_HOME=/usr/local/jdk-26.0.1 npm run test:rules`.
- Import jest globals explicitly: `import { describe, expect, test } from "@jest/globals";`
- House style: pure logic is unit-tested; screens, components and `use*` hooks that only wrap `onSnapshot` are gated by `tsc` + lint. Do not add render tests.

---

### Task 1: Install native packages and prove the build

The riskiest part of this feature is the iOS pod graph, not the product code. This task installs the packages, wires the config plugins and nothing else, so a pod-resolution dead end surfaces before twelve tasks of work sit on top of it.

**Files:**
- Modify: `package.json`
- Modify: `app.json:39-68` (the `plugins` array)

**Interfaces:**
- Consumes: nothing
- Produces: `expo-notifications`, `@react-native-firebase/app` and `@react-native-firebase/messaging` importable from app code; a `"default"` Android notification channel declared by the config plugin.

- [ ] **Step 1: Install the packages**

```bash
npx expo install expo-notifications @react-native-firebase/app @react-native-firebase/messaging
```

- [ ] **Step 2: Verify the installed versions**

```bash
node -e "const p=require('./package.json');console.log(p.dependencies['expo-notifications'],p.dependencies['@react-native-firebase/app'],p.dependencies['@react-native-firebase/messaging'])"
```

Expected: three version strings, RNFB at `^26.1.0` or newer. If `expo install` picks an RNFB version older than 26, install `@react-native-firebase/app@26.1.0 @react-native-firebase/messaging@26.1.0` explicitly — earlier majors do not declare the `expo >=47` peer.

- [ ] **Step 3: Add the config plugins to `app.json`**

In the `expo.plugins` array, add `"@react-native-firebase/app"` and the `expo-notifications` entry. The notification icon reuses the existing monochrome Android icon — it is already an all-white transparent glyph, which is exactly what Android requires.

```json
      "expo-sqlite",
      "@react-native-google-signin/google-signin",
      "@react-native-firebase/app",
      [
        "expo-notifications",
        {
          "icon": "./assets/images/android-icon-monochrome.png",
          "color": "#111827",
          "defaultChannel": "default"
        }
      ],
```

`app.json` already declares `ios.googleServicesFile` and `android.googleServicesFile`, which is what the RNFB plugin consumes — do not add them again.

- [ ] **Step 4: Rebuild the Android dev client**

```bash
npx expo run:android
```

Expected: the build succeeds and the app launches. A Metro reload does **not** include native code, so this rebuild is mandatory.

- [ ] **Step 5: Kick off the iOS build**

This machine is Linux — there is no Xcode, so `npx expo run:ios` cannot run. iOS pods are proven by an EAS cloud build instead. Start it and do **not** block on it:

```bash
npx eas-cli@latest build --platform ios --profile development --non-interactive --no-wait
```

Expected: a build URL. Record it in your report. An iOS build takes ~15-25 minutes; the controller polls it while later tasks proceed. If the command fails asking for Apple credentials or an interactive login, **do not attempt to authenticate** — report the exact error and move on; the controller escalates that to the human.

**If the build later fails** on a non-modular-header or Swift-module pod error, the fix is to add `useFrameworks: "static"` to the iOS block of the existing `expo-build-properties` plugin in `app.json`; and if that breaks the existing `GoogleUtilities` / `RecaptchaInterop` `extraPods` entries, remove those two entries — `use_frameworks! :linkage => :static` makes the `modular_headers` workaround they encode unnecessary. That fix is the controller's to schedule, not this task's.

- [ ] **Step 6: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json app.json ios android
git commit -m "feat: install expo-notifications and react-native-firebase messaging"
```

---

### Task 2: Data model — schema, typed refs, security rules

**Files:**
- Modify: `src/lib/firestore/schema.ts`
- Modify: `src/lib/firestore/collections.ts`
- Modify: `firestore.rules`
- Test: `src/lib/firestore/__tests__/rules.test.ts`

**Interfaces:**
- Consumes: Task 1 (nothing at runtime; keeps the branch linear)
- Produces:
  - `AppUser.notificationRegion: Region | null`
  - `Dossier.updatedBy: string`
  - `interface PushToken { token: string; platform: "ios" | "android"; updatedAt: Timestamp }`
  - `interface DossierMute { createdAt: Timestamp }`
  - `pushTokensRef(uid): CollectionReference<PushToken>`, `pushTokenDoc(uid, deviceId)`
  - `dossierMutesRef(dossierId): CollectionReference<DossierMute>`, `dossierMuteDoc(dossierId, uid)`

- [ ] **Step 1: Add the schema types**

In `src/lib/firestore/schema.ts`, add `notificationRegion` to `AppUser` immediately after `status`:

```ts
  status: UserStatus; // pending until the company is validated
  /**
   * Back-office only: the région this member manages. `null` = "Toute la
   * France". Drives both the dashboard filter and notification fan-out, so
   * a member can never watch NORTH while being paged about SOUTH.
   * `undefined` on accounts created before the field existed — read it
   * through `?? null`.
   */
  notificationRegion?: Region | null;
```

Add `updatedBy` to `Dossier`, immediately after `submittedBy`:

```ts
  submittedBy: string; // uid
  /**
   * Who last wrote this document. Set to `submittedBy` at creation and to the
   * back-office caller on every management update. `onDocumentUpdated` carries
   * no auth context, so this is the only way the notification trigger can skip
   * the person who made the change.
   */
  updatedBy: string; // uid
```

Add the two new collection docs at the end of the file:

```ts
// ─── push tokens (subcollection of users) ────────────────────────────────────

/**
 * One document per device. The id is a random device id minted once into
 * kv-store, not the token itself, so a rotated FCM token updates its row in
 * place instead of orphaning one.
 */
export interface PushToken {
  token: string;
  platform: "ios" | "android";
  updatedAt: Timestamp;
}

// ─── mutes (subcollection of dossiers) ───────────────────────────────────────

/**
 * Presence means "this uid has muted this dossier". Absence means subscribed —
 * which is what makes "subscribed by default" free: no backfill, and no write
 * when a dossier is created.
 */
export interface DossierMute {
  createdAt: Timestamp;
}
```

- [ ] **Step 2: Add the typed refs**

In `src/lib/firestore/collections.ts`, extend the imports and `COLLECTIONS`, then append the refs.

```ts
import type {
  AppUser,
  Company,
  Dossier,
  DossierMute,
  Invitation,
  Message,
  PushToken,
} from "./schema";
```

```ts
export const COLLECTIONS = {
  companies: "companies",
  users: "users",
  invitations: "invitations",
  dossiers: "dossiers",
  messages: "messages",
  pushTokens: "pushTokens",
  mutes: "mutes",
} as const;
```

```ts
// ─── pushTokens subcollection ────────────────────────────────────────────────

export const pushTokensRef = (uid: string) =>
  collection(userDoc(uid), COLLECTIONS.pushTokens).withConverter(
    typed<PushToken>(),
  );

export const pushTokenDoc = (uid: string, deviceId: string) =>
  doc(pushTokensRef(uid), deviceId);

// ─── mutes subcollection ─────────────────────────────────────────────────────

export const dossierMutesRef = (dossierId: string) =>
  collection(dossierDoc(dossierId), COLLECTIONS.mutes).withConverter(
    typed<DossierMute>(),
  );

export const dossierMuteDoc = (dossierId: string, uid: string) =>
  doc(dossierMutesRef(dossierId), uid);
```

- [ ] **Step 3: Write the failing rules tests**

In `src/lib/firestore/__tests__/rules.test.ts`, first add `updatedBy` to the existing `newDossier` fixture so the current create tests keep passing under the tightened rule:

```ts
const newDossier = (overrides: Record<string, unknown> = {}) => ({
  status: "a_traiter",
  region: "NORTH",
  companyId: "comp_1",
  submittedBy: "user_b2b_nord",
  updatedBy: "user_b2b_nord",
  validatedPrice: null,
  photos: [],
  thumbnailUrl: null,
  ...overrides,
});
```

Then append these tests at the end of the file:

```ts
test("a dossier cannot be created with someone else's updatedBy", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ updatedBy: "user_bo" })),
  );
});

test("the back office stamps updatedBy with its own uid on update", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "dossiers/dos_1"), {
      status: "en_cours",
      region: "NORTH",
      validatedPrice: 4200,
      updatedBy: "user_bo",
      updatedAt: new Date(),
    }),
  );
});

test("the back office cannot attribute an update to someone else", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), {
      status: "en_cours",
      region: "NORTH",
      validatedPrice: 4200,
      updatedBy: "user_b2b_nord",
      updatedAt: new Date(),
    }),
  );
});

test("a user writes and deletes their own mute on a dossier they can read", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  const ref = doc(db, "dossiers/dos_1/mutes/user_b2b_nord");
  await assertSucceeds(setDoc(ref, { createdAt: new Date() }));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(deleteDoc(ref));
});

test("a user cannot mute a dossier on someone else's behalf", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    setDoc(doc(db, "dossiers/dos_1/mutes/user_mate"), { createdAt: new Date() }),
  );
});

test("a dealer cannot mute another company's dossier", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    setDoc(doc(db, "dossiers/dos_2/mutes/user_b2b_nord"), {
      createdAt: new Date(),
    }),
  );
});

test("a user writes and reads their own push token", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  const ref = doc(db, "users/user_b2b_nord/pushTokens/device_1");
  await assertSucceeds(
    setDoc(ref, { token: "tok", platform: "android", updatedAt: new Date() }),
  );
  await assertSucceeds(getDoc(ref));
});

test("push tokens are private — even the back office cannot read them", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertFails(getDoc(doc(db, "users/user_b2b_nord/pushTokens/device_1")));
  await assertFails(
    setDoc(doc(db, "users/user_b2b_nord/pushTokens/device_2"), {
      token: "tok",
      platform: "ios",
      updatedAt: new Date(),
    }),
  );
});
```

Add `deleteDoc` to the `firebase/firestore` import at the top of the file.

- [ ] **Step 4: Run the tests to verify they fail**

```bash
JAVA_HOME=/usr/local/jdk-26.0.1 npm run test:rules
```

Expected: the new mute / pushToken tests FAIL (default-deny rejects the writes that should succeed), and the two `updatedBy` tests FAIL (the current rule ignores the field, so the "cannot attribute" case wrongly succeeds).

- [ ] **Step 5: Update `firestore.rules`**

Add the `pushTokens` nested match inside `match /users/{uid}` — subcollections do **not** inherit the parent's rules, so this must be nested, not appended:

```
      allow create, delete: if false;

      // Device handles. Owner-only: nothing in the app reads another user's
      // tokens, and the back office has no reason to enumerate devices.
      match /pushTokens/{deviceId} {
        allow read, write: if request.auth.uid == uid;
      }
    }
```

Tighten the dossier `create` rule by adding one clause after the `submittedBy` line:

```
        && request.resource.data.submittedBy == request.auth.uid
        && request.resource.data.updatedBy == request.auth.uid
```

Extend the dossier `update` rule's allow-list and pin the actor:

```
      allow update: if isBackoffice()
        && request.resource.data.diff(resource.data).affectedKeys()
             .hasOnly(['status', 'region', 'validatedPrice', 'updatedAt', 'updatedBy'])
        // The notification trigger has no auth context and reads `updatedBy`
        // to skip the person who made the change. Pinning it to the caller is
        // what stops a member silencing their own change for everyone else.
        && request.resource.data.updatedBy == request.auth.uid
        && request.resource.data.status in ['a_traiter', 'en_cours', 'cloture']
```

Add the `mutes` nested match inside `match /dossiers/{dossierId}`, next to the existing `messages` match:

```
      // Presence = muted. Only ever your own row, and only on a dossier you
      // can already read — the document's *existence* is the whole payload,
      // so its fields are not validated.
      match /mutes/{uid} {
        allow read, write: if request.auth.uid == uid
          && isDossierParticipant(dossierId);
      }
```

- [ ] **Step 6: Run the rules tests to verify they pass**

```bash
JAVA_HOME=/usr/local/jdk-26.0.1 npm run test:rules
```

Expected: PASS, including every pre-existing test.

- [ ] **Step 7: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green.

- [ ] **Step 8: Commit**

```bash
git add src/lib/firestore firestore.rules
git commit -m "feat: push token, dossier mute and notificationRegion data model"
```

---

### Task 3: Stamp `updatedBy` on every dossier write

**Files:**
- Modify: `src/features/b2b-submission/toDossier.ts:59-62`
- Modify: `src/lib/data/useDossierManagement.ts`
- Modify: `src/app/(backoffice)/dossier/[id]/management.tsx:30-38`
- Test: `src/features/b2b-submission/__tests__/toDossier.test.ts`

**Interfaces:**
- Consumes: `Dossier.updatedBy` (Task 2)
- Produces: `useDossierManagement().updateManagement(id, region, status, price, actorUid)` — note the **fifth** parameter; every call site must pass it.

- [ ] **Step 1: Write the failing test**

Append to `src/features/b2b-submission/__tests__/toDossier.test.ts`:

The file already defines top-level `session`, `company` and `photos` consts and imports `B2B_SUBMISSION_DEFAULTS` — reuse them, do not introduce new fixtures.

```ts
test("stamps updatedBy with the submitter's uid", () => {
  const d = toDossierPayload(B2B_SUBMISSION_DEFAULTS, session, company, photos);
  expect(d.updatedBy).toBe("user_b2b_nord");
  expect(d.updatedBy).toBe(d.submittedBy);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/features/b2b-submission/__tests__/toDossier.test.ts -t "updatedBy"
```

Expected: FAIL — `undefined` is not `"..."`. (`tsc` will also flag the missing property, which is the same defect.)

- [ ] **Step 3: Stamp it at creation**

In `src/features/b2b-submission/toDossier.ts`, add one line after `submittedBy`:

```ts
    companyId: company.id,
    submittedBy: session.id,
    // The create rule pins this to the caller, same as `submittedBy`. A dossier
    // is "last written by" whoever filed it until the back office touches it.
    updatedBy: session.id,
    validatedPrice: null,
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/features/b2b-submission/__tests__/toDossier.test.ts
```

Expected: PASS.

- [ ] **Step 5: Stamp it on the management update**

In `src/lib/data/useDossierManagement.ts`, extend the doc comment and the action signature:

```ts
/**
 * Back-office status / région / prix validé update (page-dossier-management).
 * These five fields are exactly what the update rule allows.
 *
 * `actorUid` is written to `updatedBy` because the notification trigger fires
 * on `onDocumentUpdated`, which carries no auth context — without it the
 * trigger cannot skip the member who made the change.
 *
 * Raced against the shared write timeout: offline, Firestore buffers the write
 * and `updateDoc` neither resolves nor rejects, so the screen would sit with a
 * live button and never navigate or error. There is nothing to compensate — an
 * update commits no uploads and creates no document — so a late-landing write
 * is simply the update the user asked for.
 */
export function useDossierManagement(options?: AsyncActionOptions) {
  const { run, pending, error } = useAsyncAction(
    async (
      id: string,
      region: Region,
      status: DossierStatus,
      price: number | null,
      actorUid: string,
    ) => {
      try {
        await writeWithTimeout(
          () =>
            updateDoc(dossierDoc(id), {
              region,
              status,
              validatedPrice: price,
              updatedBy: actorUid,
              updatedAt: serverTimestamp(),
            }),
          () => {},
          WRITE_TIMEOUT_MS,
        );
```

- [ ] **Step 6: Pass the actor from the management screen**

In `src/app/(backoffice)/dossier/[id]/management.tsx`, read the session and pass its uid. Add the import and the hook call:

```ts
import { useAccount } from "@/lib/data/useAccount";
```

```ts
  const { id } = useGlobalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useAccount();
  const { data, loading, error } = useDossier(id);
```

and in the form's `onSubmit`:

```tsx
          onSubmit={async (region, status, price) => {
            if (!session) return;
            if (await updateManagement(id, region, status, price, session.id)) {
              router.replace("/(backoffice)/confirmation");
            }
          }}
```

- [ ] **Step 7: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green. `tsc` is what proves no other call site of `updateManagement` was missed.

- [ ] **Step 8: Commit**

```bash
git add src/features/b2b-submission src/lib/data/useDossierManagement.ts "src/app/(backoffice)/dossier/[id]/management.tsx"
git commit -m "feat: stamp updatedBy on dossier create and management update"
```

---

### Task 4: Move the back-office région to the user document

`useRegionFilter` keeps its exact public API (`{ region, setRegion, ready }`), so `DashboardScreen`, `PendingCompaniesBanner`, `companies/index.tsx` and `SettingsList` need no changes at all. Only its backing store moves — from device-local kv-store to `users/{uid}.notificationRegion`.

**Files:**
- Rewrite: `src/lib/data/useRegionFilter.ts`
- Delete: `src/lib/data/region-store.ts`, `src/lib/data/region-store.web.ts`
- Rewrite: `src/lib/data/__tests__/useRegionFilter.test.ts`

**Interfaces:**
- Consumes: `AppUser.notificationRegion` (Task 2), `useAuth()` from `@/lib/auth/AuthProvider`, `userDoc` from `@/lib/firestore/collections`
- Produces: `useRegionFilter(): { region: Region | null; setRegion: (r: Region | null) => void; ready: boolean }` — unchanged shape.

- [ ] **Step 1: Write the failing test**

Replace the entire contents of `src/lib/data/__tests__/useRegionFilter.test.ts`.

Note the mocking: the repo's manual `__mocks__/firebase/firestore.js` exports only `Timestamp` / `getFirestore` / `connectFirestoreEmulator`, and `@/lib/firestore/collections` builds real refs at import time — so both have to be mocked here explicitly. `jest.mock` factories are hoisted above the imports, so any variable they close over must be named `mock*`.

```ts
import { beforeEach, expect, jest, test } from "@jest/globals";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useRegionFilter } from "@/lib/data/useRegionFilter";

const mockUpdateDoc = jest.fn<(...args: any[]) => Promise<void>>();
const mockUseAuth = jest.fn<() => any>();

jest.mock("firebase/firestore", () => ({
  updateDoc: (...args: any[]) => mockUpdateDoc(...args),
}));
jest.mock("@/lib/firestore/collections", () => ({
  userDoc: (uid: string) => ({ path: `users/${uid}` }),
}));
jest.mock("@/lib/auth/AuthProvider", () => ({
  useAuth: () => mockUseAuth(),
}));

const session = (over: Record<string, unknown> = {}) => ({
  id: "bo_1",
  role: "backoffice",
  notificationRegion: null,
  ...over,
});

beforeEach(() => {
  mockUpdateDoc.mockReset();
  mockUpdateDoc.mockResolvedValue(undefined);
  mockUseAuth.mockReturnValue({ session: session(), loading: false });
});

test("defaults to null (Toute la France) once the session has loaded", async () => {
  const { result } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.region).toBeNull();
});

test("reads a persisted 'SOUTH' off the session", async () => {
  mockUseAuth.mockReturnValue({
    session: session({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  const { result } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});

test("is not ready while the session is still loading", () => {
  mockUseAuth.mockReturnValue({ session: null, loading: true });
  const { result } = renderHook(() => useRegionFilter());
  expect(result.current.ready).toBe(false);
});

test("setRegion writes notificationRegion to the user doc", async () => {
  const { result } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("NORTH"));
  expect(mockUpdateDoc).toHaveBeenCalledWith(
    { path: "users/bo_1" },
    { notificationRegion: "NORTH" },
  );
});

test("setRegion(null) persists null rather than omitting the field", async () => {
  mockUseAuth.mockReturnValue({
    session: session({ notificationRegion: "NORTH" }),
    loading: false,
  });
  const { result } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion(null));
  expect(mockUpdateDoc).toHaveBeenCalledWith(
    { path: "users/bo_1" },
    { notificationRegion: null },
  );
});

test("the pick shows immediately and survives a failed write", async () => {
  // Optimistic: the dropdown must not sit on the old value waiting for the
  // network, and a rejected write must not throw out of the handler.
  mockUpdateDoc.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("SOUTH"));
  expect(result.current.region).toBe("SOUTH");
});

test("a session value arriving later wins over the stale default", async () => {
  const { result, rerender } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  mockUseAuth.mockReturnValue({
    session: session({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  rerender({});
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});

test("a pick is dropped once the session reports the same value", async () => {
  // Otherwise the local override would mask a later change made on another
  // device — the session would say SOUTH and the dropdown would still show it
  // as a "pending" pick forever.
  const { result, rerender } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("SOUTH"));
  mockUseAuth.mockReturnValue({
    session: session({ notificationRegion: "SOUTH" }),
    loading: false,
  });
  rerender({});
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/lib/data/__tests__/useRegionFilter.test.ts
```

Expected: FAIL — the current hook reads kv-store and never calls `updateDoc`.

- [ ] **Step 3: Rewrite the hook**

Replace the entire contents of `src/lib/data/useRegionFilter.ts`:

```ts
import { updateDoc } from "firebase/firestore";
import { useCallback, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { userDoc } from "@/lib/firestore/collections";
import type { Region } from "@/lib/firestore/schema";

/**
 * The back-office member's "région gérée".
 *
 * Backed by `users/{uid}.notificationRegion`, not device storage: the server
 * fans notifications out by this value, so a device-local preference would let
 * a member watch NORTH on screen while being paged about SOUTH. The session
 * (AuthProvider) is the read path — it already holds the `users/{uid}` document
 * — and the write is a plain `updateDoc` the owner-update rule already allows.
 *
 * The pick is held in local state as well as written, because the session only
 * refreshes on sign-in and `refreshSession()`. Without the override the
 * dropdown would snap back to the old value the moment the component
 * re-rendered. The override is cleared whenever the session catches up.
 */
export function useRegionFilter() {
  const { session, loading } = useAuth();
  const persisted = session?.notificationRegion ?? null;
  // `undefined` = no local pick outstanding. `null` is a real value here
  // ("Toute la France"), so it cannot double as the empty case.
  const [pending, setPending] = useState<Region | null | undefined>(undefined);

  // The session has caught up with the pick — stop overriding, so a change made
  // on another device is no longer masked by this one's stale choice.
  if (pending !== undefined && pending === persisted) setPending(undefined);

  const setRegion = useCallback(
    (r: Region | null) => {
      if (!session) return;
      setPending(r);
      // Fire-and-forget: the dropdown has already moved, and a failed write is
      // a preference that did not stick — not an error worth a modal.
      void updateDoc(userDoc(session.id), { notificationRegion: r }).catch(
        console.error,
      );
    },
    [session],
  );

  return {
    region: pending !== undefined ? pending : persisted,
    setRegion,
    // Consumers whose query is région-scoped must hold their loading state
    // until the session resolves, or their first render answers a
    // "Toute la France" query and visibly re-queries.
    ready: !loading,
  };
}
```

- [ ] **Step 4: Delete the kv-store modules**

```bash
git rm src/lib/data/region-store.ts src/lib/data/region-store.web.ts
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
npx jest src/lib/data/__tests__/useRegionFilter.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green. `tsc` proves nothing still imports `region-store`, and that no consumer depended on the removed `__resetRegionFilterForTests` export.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/data
git commit -m "feat: back-office région moves from kv-store to the user document"
```

---

### Task 5: Notification copy builders (functions, pure)

**Files:**
- Create: `functions/src/notifications/labels.ts`
- Create: `functions/src/notifications/copy.ts`
- Test: `functions/src/notifications/copy.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Region = "NORTH" | "SOUTH"`, `type UserRole = "b2b" | "backoffice"`, `type DossierStatus = "a_traiter" | "en_cours" | "cloture"` (re-exported from `labels.ts`)
  - `STATUS_LABELS: Record<DossierStatus, string>`, `euros(n: number | null): string`
  - `motoLabel(v: { marque?: string; modele?: string }): string`
  - `personFromSenderName(senderName: string): string`
  - `interface NotificationContent { title: string; body: string }`
  - `type NotificationTarget = { kind: "company"; companyId: string } | { kind: "dossier"; dossierId: string } | { kind: "chat"; dossierId: string }`
  - `companyRegisteredContent`, `dossierCreatedContent`, `newMessageContent`, `statusChangedContent`, `priceChangedContent`

- [ ] **Step 1: Write the failing test**

Create `functions/src/notifications/copy.test.ts`:

```ts
import { expect, test } from "@jest/globals";
import {
  companyRegisteredContent,
  dossierCreatedContent,
  motoLabel,
  newMessageContent,
  personFromSenderName,
  priceChangedContent,
  statusChangedContent,
} from "./copy";

test("motoLabel joins marque and modele", () => {
  expect(motoLabel({ marque: "Yamaha", modele: "MT-07" })).toBe("Yamaha MT-07");
});

test("motoLabel drops a missing half rather than leaving a stray space", () => {
  expect(motoLabel({ marque: "Yamaha", modele: "" })).toBe("Yamaha");
  expect(motoLabel({ marque: "", modele: "MT-07" })).toBe("MT-07");
});

test("motoLabel falls back when nothing was filled in", () => {
  expect(motoLabel({ marque: "", modele: "" })).toBe("Moto non renseignée");
  expect(motoLabel({})).toBe("Moto non renseignée");
});

test("personFromSenderName strips the trailing company", () => {
  expect(personFromSenderName("Camille Durand - Garage du Nord")).toBe(
    "Camille Durand",
  );
  expect(personFromSenderName("Lou Verdier - Bike-eco")).toBe("Lou Verdier");
});

test("personFromSenderName splits on the LAST separator", () => {
  // A company name may itself contain " - ".
  expect(personFromSenderName("Camille Durand - Moto - Sud")).toBe(
    "Camille Durand - Moto",
  );
});

test("personFromSenderName returns the whole string when there is no company", () => {
  expect(personFromSenderName("Camille Durand")).toBe("Camille Durand");
});

test("company registration copy", () => {
  expect(
    companyRegisteredContent({
      companyName: "Garage du Nord",
      createdByName: "Camille Durand",
    }),
  ).toEqual({
    title: "1 nouvelle entreprise s'est inscrite",
    body: "Garage du Nord\nCamille Durand",
  });
});

test("new dossier copy", () => {
  expect(
    dossierCreatedContent({
      companyName: "Garage du Nord",
      sellerName: "Camille Durand",
    }),
  ).toEqual({
    title: "Une nouvelle proposition d'achat vient d'être publié.",
    body: "Entreprise Garage du Nord\nVendeur : Camille Durand",
  });
});

test("a back-office recipient sees who sent the message", () => {
  expect(
    newMessageContent({ recipientRole: "backoffice", senderPerson: "Camille Durand", moto: "Yamaha MT-07" }),
  ).toEqual({
    title: "1 nouveau message de Camille Durand",
    body: "Pour la Yamaha MT-07",
  });
});

test("a b2b recipient always sees Bike-eco as the sender", () => {
  expect(
    newMessageContent({ recipientRole: "b2b", senderPerson: "Lou Verdier", moto: "Yamaha MT-07" }),
  ).toEqual({
    title: "1 nouveau message de Bike-eco",
    body: "Pour la Yamaha MT-07",
  });
});

test("status change copy uses the French label", () => {
  expect(statusChangedContent({ moto: "Yamaha MT-07", status: "cloture" })).toEqual({
    title: "Le statut de la Yamaha MT-07 a évolué",
    body: "Nouveau statut: Clôturé",
  });
});

test("price change copy formats euros", () => {
  expect(
    priceChangedContent({ moto: "Yamaha MT-07", validatedPrice: 4200 }),
  ).toEqual({
    title: "Le prix validé de la Yamaha MT-07 a évolué",
    body: "Prix validé: 4200 €",
  });
});

test("a cleared price reads as a dash, never as 'null €'", () => {
  expect(
    priceChangedContent({ moto: "Yamaha MT-07", validatedPrice: null }),
  ).toEqual({
    title: "Le prix validé de la Yamaha MT-07 a évolué",
    body: "Prix validé: —",
  });
});

test("an unfilled vehicle still produces the fallback in every dossier string", () => {
  const moto = motoLabel({ marque: "", modele: "" });
  expect(statusChangedContent({ moto, status: "en_cours" }).title).toBe(
    "Le statut de la Moto non renseignée a évolué",
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd functions && npx jest src/notifications/copy.test.ts
```

Expected: FAIL — `Cannot find module './copy'`.

- [ ] **Step 3: Write `labels.ts`**

Create `functions/src/notifications/labels.ts`:

```ts
/**
 * French labels and formatters for notification copy.
 *
 * Duplicated from `src/lib/ui/format.ts` in the Expo app, for the same reason
 * `functions/src/regions.ts` duplicates the département map: the functions
 * package compiles in isolation and cannot cleanly import from the app
 * sources. Keep both copies in sync when a label or a unit changes.
 */

export type Region = "NORTH" | "SOUTH";
export type UserRole = "b2b" | "backoffice";
export type DossierStatus = "a_traiter" | "en_cours" | "cloture";

export const STATUS_LABELS: Record<DossierStatus, string> = {
  a_traiter: "À traiter",
  en_cours: "En cours",
  cloture: "Clôturé",
};

/** Units live in the value; an absent price is dashed, never "null €". */
export const euros = (n: number | null | undefined): string =>
  n === null || n === undefined ? "—" : `${n} €`;
```

- [ ] **Step 4: Write `copy.ts`**

Create `functions/src/notifications/copy.ts`:

```ts
import { STATUS_LABELS, euros, type DossierStatus, type UserRole } from "./labels";

/** Line 1 becomes the FCM `title`; the rest become the `\n`-joined `body`. */
export interface NotificationContent {
  title: string;
  body: string;
}

/** Where a tap should land. Serialized into the FCM `data` block. */
export type NotificationTarget =
  | { kind: "company"; companyId: string }
  | { kind: "dossier"; dossierId: string }
  | { kind: "chat"; dossierId: string };

const lines = (title: string, ...rest: string[]): NotificationContent => ({
  title,
  body: rest.join("\n"),
});

/** "Yamaha MT-07", or the fallback when the dealer filled in neither field. */
export function motoLabel(v: { marque?: string; modele?: string }): string {
  return [v.marque, v.modele].filter(Boolean).join(" ") || "Moto non renseignée";
}

/**
 * `Message.senderName` is stamped as "Prénom Nom - Entreprise" (or
 * "- Bike-eco") by the sendMessage callable. The notification wants only the
 * person, and reading `users/{senderId}` instead would break for a deleted
 * colleague — the denormalized name is the only copy guaranteed to survive.
 *
 * Splits on the LAST " - " because a company name may contain one.
 */
export function personFromSenderName(senderName: string): string {
  const at = senderName.lastIndexOf(" - ");
  return at === -1 ? senderName : senderName.slice(0, at);
}

export function companyRegisteredContent(input: {
  companyName: string;
  createdByName: string;
}): NotificationContent {
  return lines(
    "1 nouvelle entreprise s'est inscrite",
    input.companyName,
    input.createdByName,
  );
}

export function dossierCreatedContent(input: {
  companyName: string;
  sellerName: string;
}): NotificationContent {
  return lines(
    "Une nouvelle proposition d'achat vient d'être publié.",
    `Entreprise ${input.companyName}`,
    `Vendeur : ${input.sellerName}`,
  );
}

/**
 * A b2b recipient is only ever notified of a back-office message (see
 * `resolveDeliveries`), which is why "de Bike-eco" can be unconditional here.
 */
export function newMessageContent(input: {
  recipientRole: UserRole;
  senderPerson: string;
  moto: string;
}): NotificationContent {
  const from = input.recipientRole === "b2b" ? "Bike-eco" : input.senderPerson;
  return lines(`1 nouveau message de ${from}`, `Pour la ${input.moto}`);
}

export function statusChangedContent(input: {
  moto: string;
  status: DossierStatus;
}): NotificationContent {
  return lines(
    `Le statut de la ${input.moto} a évolué`,
    `Nouveau statut: ${STATUS_LABELS[input.status]}`,
  );
}

export function priceChangedContent(input: {
  moto: string;
  validatedPrice: number | null;
}): NotificationContent {
  return lines(
    `Le prix validé de la ${input.moto} a évolué`,
    `Prix validé: ${euros(input.validatedPrice)}`,
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd functions && npx jest src/notifications/copy.test.ts
```

Expected: PASS, 13 tests.

- [ ] **Step 6: Run the functions gate**

```bash
cd functions && npx tsc --noEmit && npm test && npm run lint
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add functions/src/notifications
git commit -m "feat: notification copy builders"
```

---

### Task 6: Recipient resolution (functions, pure)

Returns a list of `Delivery` values rather than calling a `send` dep, so the test asserts on data instead of on spy calls.

**Files:**
- Create: `functions/src/notifications/core.ts`
- Test: `functions/src/notifications/core.test.ts`

**Interfaces:**
- Consumes: `NotificationContent`, `NotificationTarget`, and the five `*Content` builders from `./copy` (Task 5); `Region`, `UserRole`, `DossierStatus` from `./labels`
- Produces:
  - `interface Recipient { uid: string; role: UserRole; notificationRegion: Region | null }`
  - `interface ResolveDeps { backofficeUsers(): Promise<Recipient[]>; companyMembers(companyId: string): Promise<Recipient[]>; mutedUids(dossierId: string): Promise<string[]> }`
  - `type NotificationEvent` (5-arm discriminated union, defined below)
  - `interface Delivery { uid: string; content: NotificationContent; target: NotificationTarget }`
  - `resolveDeliveries(event: NotificationEvent, deps: ResolveDeps): Promise<Delivery[]>`

- [ ] **Step 1: Write the failing test**

Create `functions/src/notifications/core.test.ts`:

```ts
import { expect, test } from "@jest/globals";
import {
  resolveDeliveries,
  type NotificationEvent,
  type Recipient,
  type ResolveDeps,
} from "./core";

const bo = (uid: string, region: Recipient["notificationRegion"]): Recipient => ({
  uid,
  role: "backoffice",
  notificationRegion: region,
});

const dealer = (uid: string): Recipient => ({
  uid,
  role: "b2b",
  notificationRegion: null,
});

const BACKOFFICE = [bo("bo_north", "NORTH"), bo("bo_south", "SOUTH"), bo("bo_all", null)];
const MEMBERS = [dealer("dealer_1"), dealer("dealer_2")];

function deps(over: Partial<ResolveDeps> = {}): ResolveDeps {
  return {
    backofficeUsers: async () => BACKOFFICE,
    companyMembers: async () => MEMBERS,
    mutedUids: async () => [],
    ...over,
  };
}

const uids = (d: { uid: string }[]) => d.map((x) => x.uid).sort();

const messageEvent = (over: Partial<Extract<NotificationEvent, { kind: "messageCreated" }>> = {}) =>
  ({
    kind: "messageCreated",
    dossierId: "dos_1",
    region: "NORTH",
    companyId: "comp_1",
    senderUid: "bo_north",
    senderRole: "backoffice",
    senderName: "Lou Verdier - Bike-eco",
    moto: "Yamaha MT-07",
    ...over,
  }) as NotificationEvent;

// ─── région fan-out ──────────────────────────────────────────────────────────

test("a new company reaches its région plus Toute-la-France, and no one else", async () => {
  const out = await resolveDeliveries(
    {
      kind: "companyRegistered",
      companyId: "comp_1",
      companyName: "Garage du Nord",
      createdByName: "Camille Durand",
      region: "NORTH",
    },
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "bo_north"]);
});

test("a new company targets its own company page", async () => {
  const out = await resolveDeliveries(
    {
      kind: "companyRegistered",
      companyId: "comp_1",
      companyName: "Garage du Nord",
      createdByName: "Camille Durand",
      region: "SOUTH",
    },
    deps(),
  );
  expect(out[0].target).toEqual({ kind: "company", companyId: "comp_1" });
  expect(uids(out)).toEqual(["bo_all", "bo_south"]);
});

test("a new dossier reaches the région's back office and targets the dossier", async () => {
  const out = await resolveDeliveries(
    {
      kind: "dossierCreated",
      dossierId: "dos_1",
      region: "SOUTH",
      companyName: "Garage du Sud",
      sellerName: "Camille Durand",
    },
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "bo_south"]);
  expect(out[0].target).toEqual({ kind: "dossier", dossierId: "dos_1" });
  expect(out[0].content.title).toBe(
    "Une nouvelle proposition d'achat vient d'être publié.",
  );
});

test("a new dossier never notifies the dealers who filed it", async () => {
  const out = await resolveDeliveries(
    {
      kind: "dossierCreated",
      dossierId: "dos_1",
      region: "NORTH",
      companyName: "Garage du Nord",
      sellerName: "Camille Durand",
    },
    deps(),
  );
  expect(uids(out)).not.toContain("dealer_1");
});

// ─── messages ────────────────────────────────────────────────────────────────

test("a back-office message reaches the company and the other back-office members", async () => {
  const out = await resolveDeliveries(messageEvent(), deps());
  expect(uids(out)).toEqual(["bo_all", "dealer_1", "dealer_2"]);
});

test("the sender is never notified of their own message", async () => {
  const out = await resolveDeliveries(messageEvent({ senderUid: "bo_all" }), deps());
  expect(uids(out)).not.toContain("bo_all");
});

test("a b2b message does NOT reach the sender's own teammates", async () => {
  // The b2b copy is hardcoded to "de Bike-eco", so notifying a teammate would
  // misattribute their colleague's message to the Bike-eco team.
  const out = await resolveDeliveries(
    messageEvent({ senderUid: "dealer_1", senderRole: "b2b", senderName: "Camille Durand - Garage du Nord" }),
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "bo_north"]);
});

test("copy differs by recipient role on the same message", async () => {
  const out = await resolveDeliveries(messageEvent(), deps());
  const toBackoffice = out.find((d) => d.uid === "bo_all")!;
  const toDealer = out.find((d) => d.uid === "dealer_1")!;
  expect(toBackoffice.content.title).toBe("1 nouveau message de Lou Verdier");
  expect(toDealer.content.title).toBe("1 nouveau message de Bike-eco");
  expect(toDealer.content.body).toBe("Pour la Yamaha MT-07");
});

test("a message targets the chat, not the dossier", async () => {
  const out = await resolveDeliveries(messageEvent(), deps());
  expect(out[0].target).toEqual({ kind: "chat", dossierId: "dos_1" });
});

// ─── mutes ───────────────────────────────────────────────────────────────────

test("a muted uid is dropped from a message fan-out", async () => {
  const out = await resolveDeliveries(
    messageEvent(),
    deps({ mutedUids: async () => ["dealer_1", "bo_all"] }),
  );
  expect(uids(out)).toEqual(["dealer_2"]);
});

test("mutes do not apply to the new-dossier event", async () => {
  // Nobody can have muted a dossier that has only just been created, but the
  // resolver must not go looking either — it has no subcollection to read.
  const out = await resolveDeliveries(
    {
      kind: "dossierCreated",
      dossierId: "dos_1",
      region: "NORTH",
      companyName: "Garage du Nord",
      sellerName: "Camille Durand",
    },
    deps({
      mutedUids: async () => {
        throw new Error("must not be called");
      },
    }),
  );
  expect(uids(out)).toEqual(["bo_all", "bo_north"]);
});

// ─── status / price ──────────────────────────────────────────────────────────

test("a status change reaches the company and the région, minus the actor", async () => {
  const out = await resolveDeliveries(
    {
      kind: "statusChanged",
      dossierId: "dos_1",
      region: "NORTH",
      companyId: "comp_1",
      actorUid: "bo_north",
      moto: "Yamaha MT-07",
      status: "cloture",
    },
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "dealer_1", "dealer_2"]);
  expect(out[0].content).toEqual({
    title: "Le statut de la Yamaha MT-07 a évolué",
    body: "Nouveau statut: Clôturé",
  });
  expect(out[0].target).toEqual({ kind: "dossier", dossierId: "dos_1" });
});

test("a status change reads the same for both roles", async () => {
  const out = await resolveDeliveries(
    {
      kind: "statusChanged",
      dossierId: "dos_1",
      region: "NORTH",
      companyId: "comp_1",
      actorUid: "bo_north",
      moto: "Yamaha MT-07",
      status: "en_cours",
    },
    deps(),
  );
  const titles = new Set(out.map((d) => d.content.title));
  expect(titles.size).toBe(1);
});

test("a price change reaches the same set and formats euros", async () => {
  const out = await resolveDeliveries(
    {
      kind: "priceChanged",
      dossierId: "dos_1",
      region: "SOUTH",
      companyId: "comp_1",
      actorUid: "bo_south",
      moto: "Yamaha MT-07",
      validatedPrice: 4200,
    },
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "dealer_1", "dealer_2"]);
  expect(out[0].content.body).toBe("Prix validé: 4200 €");
});

test("no recipients yields no deliveries rather than throwing", async () => {
  const out = await resolveDeliveries(
    messageEvent({ senderUid: "bo_north" }),
    deps({ backofficeUsers: async () => [], companyMembers: async () => [] }),
  );
  expect(out).toEqual([]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd functions && npx jest src/notifications/core.test.ts
```

Expected: FAIL — `Cannot find module './core'`.

- [ ] **Step 3: Write `core.ts`**

Create `functions/src/notifications/core.ts`:

```ts
import {
  companyRegisteredContent,
  dossierCreatedContent,
  newMessageContent,
  personFromSenderName,
  priceChangedContent,
  statusChangedContent,
  type NotificationContent,
  type NotificationTarget,
} from "./copy";
import type { DossierStatus, Region, UserRole } from "./labels";

/** The subset of a `users/{uid}` document fan-out needs. */
export interface Recipient {
  uid: string;
  role: UserRole;
  notificationRegion: Region | null;
}

export interface ResolveDeps {
  /** Every *active* back-office user. Filtered by région here, not in the query. */
  backofficeUsers(): Promise<Recipient[]>;
  /** Every *active* member of a company. */
  companyMembers(companyId: string): Promise<Recipient[]>;
  /** uids with a `dossiers/{id}/mutes/{uid}` document. */
  mutedUids(dossierId: string): Promise<string[]>;
}

export type NotificationEvent =
  | {
      kind: "companyRegistered";
      companyId: string;
      companyName: string;
      createdByName: string;
      region: Region;
    }
  | {
      kind: "dossierCreated";
      dossierId: string;
      region: Region;
      companyName: string;
      sellerName: string;
    }
  | {
      kind: "messageCreated";
      dossierId: string;
      region: Region;
      companyId: string;
      senderUid: string;
      senderRole: UserRole;
      /** The stamped "Prénom Nom - Entreprise" form, not the bare person. */
      senderName: string;
      moto: string;
    }
  | {
      kind: "statusChanged";
      dossierId: string;
      region: Region;
      companyId: string;
      actorUid: string;
      moto: string;
      status: DossierStatus;
    }
  | {
      kind: "priceChanged";
      dossierId: string;
      region: Region;
      companyId: string;
      actorUid: string;
      moto: string;
      validatedPrice: number | null;
    };

/** One notification, for one person. */
export interface Delivery {
  uid: string;
  content: NotificationContent;
  target: NotificationTarget;
}

/**
 * A back-office member manages a région (or all of France, `null`). Filtering
 * in memory rather than in the query keeps the `null` case out of Firestore's
 * `in` semantics — and the back-office team is a handful of people.
 */
function inRegion(user: Recipient, region: Region): boolean {
  return user.notificationRegion === null || user.notificationRegion === region;
}

/**
 * The people who care about an existing dossier: the back office that manages
 * its région, plus the dealership that filed it. Callers subtract the actor and
 * the mutes.
 */
async function dossierAudience(
  event: { region: Region; companyId: string },
  deps: ResolveDeps,
): Promise<Recipient[]> {
  const [backoffice, members] = await Promise.all([
    deps.backofficeUsers(),
    deps.companyMembers(event.companyId),
  ]);
  return [...backoffice.filter((u) => inRegion(u, event.region)), ...members];
}

function exclude(users: Recipient[], uids: Set<string>): Recipient[] {
  return users.filter((u) => !uids.has(u.uid));
}

export async function resolveDeliveries(
  event: NotificationEvent,
  deps: ResolveDeps,
): Promise<Delivery[]> {
  switch (event.kind) {
    case "companyRegistered": {
      const target: NotificationTarget = {
        kind: "company",
        companyId: event.companyId,
      };
      const content = companyRegisteredContent(event);
      const users = (await deps.backofficeUsers()).filter((u) =>
        inRegion(u, event.region),
      );
      return users.map((u) => ({ uid: u.uid, content, target }));
    }

    case "dossierCreated": {
      // No mute lookup: the dossier is one write old, so its `mutes`
      // subcollection cannot exist yet.
      const target: NotificationTarget = {
        kind: "dossier",
        dossierId: event.dossierId,
      };
      const content = dossierCreatedContent(event);
      const users = (await deps.backofficeUsers()).filter((u) =>
        inRegion(u, event.region),
      );
      return users.map((u) => ({ uid: u.uid, content, target }));
    }

    case "messageCreated": {
      const target: NotificationTarget = {
        kind: "chat",
        dossierId: event.dossierId,
      };
      const [backoffice, members, muted] = await Promise.all([
        deps.backofficeUsers(),
        // A b2b message is not relayed to the sender's own teammates: the b2b
        // copy is fixed to "de Bike-eco", so it would misattribute a
        // colleague's message to the Bike-eco team.
        event.senderRole === "backoffice"
          ? deps.companyMembers(event.companyId)
          : Promise.resolve<Recipient[]>([]),
        deps.mutedUids(event.dossierId),
      ]);
      const audience = [
        ...backoffice.filter((u) => inRegion(u, event.region)),
        ...members,
      ];
      const skip = new Set([event.senderUid, ...muted]);
      const senderPerson = personFromSenderName(event.senderName);
      return exclude(audience, skip).map((u) => ({
        uid: u.uid,
        content: newMessageContent({
          recipientRole: u.role,
          senderPerson,
          moto: event.moto,
        }),
        target,
      }));
    }

    case "statusChanged":
    case "priceChanged": {
      const target: NotificationTarget = {
        kind: "dossier",
        dossierId: event.dossierId,
      };
      const content =
        event.kind === "statusChanged"
          ? statusChangedContent(event)
          : priceChangedContent(event);
      const [audience, muted] = await Promise.all([
        dossierAudience(event, deps),
        deps.mutedUids(event.dossierId),
      ]);
      const skip = new Set([event.actorUid, ...muted]);
      return exclude(audience, skip).map((u) => ({ uid: u.uid, content, target }));
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd functions && npx jest src/notifications/core.test.ts
```

Expected: PASS, 15 tests.

- [ ] **Step 5: Run the functions gate**

```bash
cd functions && npx tsc --noEmit && npm test && npm run lint
```

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add functions/src/notifications
git commit -m "feat: notification recipient resolution"
```

---

### Task 7: Firestore triggers and FCM dispatch

**Files:**
- Create: `functions/src/notifications/send.ts`
- Create: `functions/src/notifications/index.ts`
- Modify: `functions/src/index.ts:8-14`
- Test: `functions/src/notifications/send.test.ts`

**Interfaces:**
- Consumes: `resolveDeliveries`, `Delivery`, `NotificationEvent`, `Recipient`, `ResolveDeps` (Task 6); `motoLabel` (Task 5); `db()` from `../callable`
- Produces: exported triggers `onCompanyCreated`, `onDossierCreated`, `onDossierMessageCreated`, `onDossierUpdated`
- Produces: `chunk<T>(items: T[], size: number): T[][]`, `targetData(target: NotificationTarget): Record<string, string>`, `FCM_BATCH_SIZE`

- [ ] **Step 1: Write the failing test**

Create `functions/src/notifications/send.test.ts`:

```ts
import { expect, test } from "@jest/globals";
import { FCM_BATCH_SIZE, chunk, targetData } from "./send";

test("chunk splits into batches of at most `size`", () => {
  expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
});

test("chunk of an empty list is an empty list of batches", () => {
  expect(chunk([], 10)).toEqual([]);
});

test("chunk leaves a list shorter than `size` in one batch", () => {
  expect(chunk([1, 2], 500)).toEqual([[1, 2]]);
});

test("the FCM batch size respects sendEachForMulticast's 500-token cap", () => {
  expect(FCM_BATCH_SIZE).toBeLessThanOrEqual(500);
});

test("targetData serializes every target as flat strings", () => {
  // FCM data values must be strings — a number or a nested object is rejected
  // at send time, not at compile time.
  expect(targetData({ kind: "company", companyId: "comp_1" })).toEqual({
    kind: "company",
    companyId: "comp_1",
  });
  expect(targetData({ kind: "dossier", dossierId: "dos_1" })).toEqual({
    kind: "dossier",
    dossierId: "dos_1",
  });
  expect(targetData({ kind: "chat", dossierId: "dos_1" })).toEqual({
    kind: "chat",
    dossierId: "dos_1",
  });
});

test("every targetData value is a string", () => {
  const data = targetData({ kind: "dossier", dossierId: "dos_1" });
  for (const value of Object.values(data)) {
    expect(typeof value).toBe("string");
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd functions && npx jest src/notifications/send.test.ts
```

Expected: FAIL — `Cannot find module './send'`.

- [ ] **Step 3: Write `send.ts`**

Create `functions/src/notifications/send.ts`:

```ts
import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

import { db } from "../callable";
import type { NotificationTarget } from "./copy";
import type { Delivery } from "./core";

/** `sendEachForMulticast` accepts at most 500 tokens per call. */
export const FCM_BATCH_SIZE = 500;

/** Per-token errors that mean the handle is dead and its row should go. */
const DEAD_TOKEN_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
]);

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** FCM data values must be strings, so the target is flattened, never nested. */
export function targetData(target: NotificationTarget): Record<string, string> {
  return target.kind === "company"
    ? { kind: target.kind, companyId: target.companyId }
    : { kind: target.kind, dossierId: target.dossierId };
}

interface TokenRow {
  uid: string;
  deviceId: string;
  token: string;
}

/** Every registered device for these uids. */
async function tokensFor(uids: string[]): Promise<TokenRow[]> {
  const rows = await Promise.all(
    uids.map(async (uid) => {
      const snap = await db().collection("users").doc(uid).collection("pushTokens").get();
      return snap.docs.map((d) => ({
        uid,
        deviceId: d.id,
        token: d.data().token as string,
      }));
    }),
  );
  return rows.flat();
}

async function deleteToken(row: TokenRow): Promise<void> {
  await db()
    .collection("users").doc(row.uid)
    .collection("pushTokens").doc(row.deviceId)
    .delete()
    .catch((e) => logger.warn("Failed to prune push token", { uid: row.uid, error: String(e) }));
}

/**
 * Fan a resolved delivery list out to every registered device.
 *
 * One `sendEachForMulticast` call per distinct notification body, batched at
 * the 500-token cap. Tokens whose per-token response says the handle is dead
 * are deleted — Apple and Google both ask that you stop sending to them.
 */
export async function dispatch(deliveries: Delivery[]): Promise<void> {
  if (deliveries.length === 0) return;

  const rows = await tokensFor([...new Set(deliveries.map((d) => d.uid))]);
  if (rows.length === 0) return;
  const byUid = new Map<string, TokenRow[]>();
  for (const row of rows) {
    byUid.set(row.uid, [...(byUid.get(row.uid) ?? []), row]);
  }

  // Recipients of an identical notification share one multicast. The key is the
  // rendered copy plus the target, so the message-event's two role-dependent
  // variants stay separate.
  const groups = new Map<string, { delivery: Delivery; rows: TokenRow[] }>();
  for (const delivery of deliveries) {
    const key = JSON.stringify([delivery.content, delivery.target]);
    const existing = groups.get(key);
    const forUid = byUid.get(delivery.uid) ?? [];
    if (existing) existing.rows.push(...forUid);
    else groups.set(key, { delivery, rows: [...forUid] });
  }

  for (const { delivery, rows: groupRows } of groups.values()) {
    for (const batch of chunk(groupRows, FCM_BATCH_SIZE)) {
      if (batch.length === 0) continue;
      try {
        const result = await getMessaging().sendEachForMulticast({
          tokens: batch.map((r) => r.token),
          notification: {
            title: delivery.content.title,
            body: delivery.content.body,
          },
          data: targetData(delivery.target),
          android: {
            priority: "high",
            notification: { channelId: "default" },
          },
          apns: { payload: { aps: { sound: "default" } } },
        });
        await Promise.all(
          result.responses.map(async (response, i) => {
            if (response.success) return;
            const code = response.error?.code ?? "";
            if (DEAD_TOKEN_CODES.has(code)) await deleteToken(batch[i]);
            else logger.warn("Push send failed", { code, uid: batch[i].uid });
          }),
        );
      } catch (e) {
        // `retry: false` on every trigger, so this is where a send failure
        // stops. A missed notification is strictly better than a duplicate.
        logger.error("Multicast failed", { error: String(e) });
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd functions && npx jest src/notifications/send.test.ts
```

Expected: PASS, 6 tests.

- [ ] **Step 5: Write the triggers**

Create `functions/src/notifications/index.ts`:

```ts
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/firestore";
import * as logger from "firebase-functions/logger";

import { db } from "../callable";
import { motoLabel } from "./copy";
import { resolveDeliveries, type NotificationEvent, type Recipient, type ResolveDeps } from "./core";
import type { DossierStatus, Region, UserRole } from "./labels";
import { dispatch } from "./send";

/**
 * App data lives in the named `bike-eco-db`, NOT `(default)`. A trigger
 * declared without `database` binds to the default database and silently never
 * fires — there is no error to notice.
 *
 * `retry: false` on all four: a notification has no compensating action, and a
 * duplicate push is worse than a missed one.
 */
const TRIGGER = { database: "bike-eco-db", retry: false } as const;

function toRecipient(uid: string, data: FirebaseFirestore.DocumentData): Recipient {
  return {
    uid,
    role: data.role as UserRole,
    notificationRegion: (data.notificationRegion as Region | null | undefined) ?? null,
  };
}

function resolveDeps(): ResolveDeps {
  return {
    // Equality-only filters, so Firestore serves this from single-field
    // indexes. If it ever answers `failed-precondition` asking for a composite
    // index, add it to firestore.indexes.json.
    backofficeUsers: async () => {
      const snap = await db()
        .collection("users")
        .where("role", "==", "backoffice")
        .where("status", "==", "active")
        .get();
      return snap.docs.map((d) => toRecipient(d.id, d.data()));
    },
    companyMembers: async (companyId) => {
      const snap = await db()
        .collection("users")
        .where("companyId", "==", companyId)
        .where("status", "==", "active")
        .get();
      return snap.docs.map((d) => toRecipient(d.id, d.data()));
    },
    mutedUids: async (dossierId) => {
      const snap = await db()
        .collection("dossiers").doc(dossierId)
        .collection("mutes")
        .get();
      return snap.docs.map((d) => d.id);
    },
  };
}

/** Resolve + send, logging rather than throwing: `retry: false` means a throw
 *  buys nothing, and a notification must never look like a failed write. */
async function emit(event: NotificationEvent): Promise<void> {
  try {
    await dispatch(await resolveDeliveries(event, resolveDeps()));
  } catch (e) {
    logger.error("Notification fan-out failed", { kind: event.kind, error: String(e) });
  }
}

export const onCompanyCreated = onDocumentCreated(
  { ...TRIGGER, document: "companies/{companyId}" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    await emit({
      kind: "companyRegistered",
      companyId: event.params.companyId,
      companyName: (data.name as string) ?? "",
      createdByName: (data.createdByName as string) ?? "",
      region: data.region as Region,
    });
  },
);

export const onDossierCreated = onDocumentCreated(
  { ...TRIGGER, document: "dossiers/{dossierId}" },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const submitter = (data.submitter ?? {}) as { prenom?: string; nom?: string; companyName?: string };
    await emit({
      kind: "dossierCreated",
      dossierId: event.params.dossierId,
      region: data.region as Region,
      companyName: submitter.companyName ?? "",
      sellerName: `${submitter.prenom ?? ""} ${submitter.nom ?? ""}`.trim(),
    });
  },
);

export const onDossierMessageCreated = onDocumentCreated(
  { ...TRIGGER, document: "dossiers/{dossierId}/messages/{messageId}" },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;
    const dossierSnap = await db().collection("dossiers").doc(event.params.dossierId).get();
    const dossier = dossierSnap.data();
    if (!dossier) return;
    await emit({
      kind: "messageCreated",
      dossierId: event.params.dossierId,
      region: dossier.region as Region,
      companyId: dossier.companyId as string,
      senderUid: message.senderId as string,
      senderRole: message.senderRole as UserRole,
      senderName: (message.senderName as string) ?? "",
      moto: motoLabel((dossier.vehicle ?? {}) as { marque?: string; modele?: string }),
    });
  },
);

/**
 * Status and prix validé are two distinct notifications in the spec, so a
 * single management submit that changes both sends both.
 */
export const onDossierUpdated = onDocumentUpdated(
  { ...TRIGGER, document: "dossiers/{dossierId}" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const shared = {
      dossierId: event.params.dossierId,
      region: after.region as Region,
      companyId: after.companyId as string,
      actorUid: (after.updatedBy as string) ?? "",
      moto: motoLabel((after.vehicle ?? {}) as { marque?: string; modele?: string }),
    };

    if (before.status !== after.status) {
      await emit({ kind: "statusChanged", ...shared, status: after.status as DossierStatus });
    }
    if (before.validatedPrice !== after.validatedPrice) {
      await emit({
        kind: "priceChanged",
        ...shared,
        validatedPrice: (after.validatedPrice as number | null) ?? null,
      });
    }
  },
);
```

- [ ] **Step 6: Export the triggers**

In `functions/src/index.ts`, add one export line alongside the existing ones:

```ts
export { sendMessage } from "./messages";
export {
  onCompanyCreated, onDossierCreated, onDossierMessageCreated, onDossierUpdated
} from "./notifications";
export {
  acceptInvite,
  approveCompany, deleteCompany, registerCompany, resolveInvite, sendInvite
} from "./registration";
```

- [ ] **Step 7: Run the functions gate**

```bash
cd functions && npx tsc --noEmit && npm test && npm run lint
```

Expected: all green, 34 tests across the three notification test files plus the pre-existing suites.

- [ ] **Step 8: Verify the triggers register in the emulator**

```bash
cd functions && npm run build
JAVA_HOME=/usr/local/jdk-26.0.1 npx firebase-tools@latest emulators:start --only functions,firestore --project bike-eco-43a84
```

Expected: the startup log lists all four triggers, each annotated with the `bike-eco-db` database. If any shows `(default)`, the `database` option is missing — fix it before moving on. Stop the emulator with Ctrl-C.

- [ ] **Step 9: Commit**

```bash
git add functions/src
git commit -m "feat: Firestore notification triggers and FCM dispatch"
```

---

### Task 8: Push-token registration and the permission prompt

**Files:**
- Create: `src/lib/notifications/deviceId.ts`
- Create: `src/lib/notifications/pushRegistration.ts`
- Create: `src/lib/notifications/pushRegistration.web.ts`
- Create: `src/lib/notifications/usePushRegistration.ts`
- Modify: `src/lib/auth/AuthProvider.tsx` (sign-out path)
- Modify: `src/components/screens/DashboardScreen.tsx`
- Modify: `src/components/form/SettingsList.tsx`

This task is wiring around a native module, so its gate is `tsc` + lint + the existing suite — matching the house rule that `use*` hooks and screens are not render-tested. The pure part worth testing (`resolveRoute`) lands in Task 9.

**Interfaces:**
- Consumes: `pushTokenDoc` (Task 2)
- Produces:
  - `getDeviceId(): Promise<string>`
  - `registerPushToken(uid: string): Promise<() => void>` — resolves to an unsubscribe for the token-refresh listener
  - `unregisterPushToken(uid: string): Promise<void>`
  - `getPushPermission(): Promise<"granted" | "denied" | "undetermined">`
  - `usePushRegistration(): void` — call once from each dashboard
  - `usePushPermission(): { status: "granted" | "denied" | "undetermined" | "loading" }`

- [ ] **Step 1: Write `deviceId.ts`**

```ts
import Storage from "expo-sqlite/kv-store";

const KEY = "push.deviceId";

/**
 * A stable per-install id, used as the `users/{uid}/pushTokens/{deviceId}`
 * document id.
 *
 * Not the FCM token itself: tokens rotate, and keying by the token would leave
 * an orphaned row behind on every rotation, which then collects failed sends
 * until FCM finally reports it dead.
 */
export async function getDeviceId(): Promise<string> {
  const existing = await Storage.getItem(KEY);
  if (existing) return existing;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await Storage.setItem(KEY, id);
  return id;
}
```

- [ ] **Step 2: Write `pushRegistration.ts`**

```ts
import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { deleteDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";

import { pushTokenDoc } from "@/lib/firestore/collections";
import { getDeviceId } from "./deviceId";

export type PushPermission = "granted" | "denied" | "undetermined";

/**
 * Android 13+ will not show the runtime prompt until at least one notification
 * channel exists, and `getToken()` needs the permission — so the channel has to
 * be created first, every time, before anything else.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "Notifications Bike-eco",
    importance: Notifications.AndroidImportance.HIGH,
  });
}

function toPermission(status: Notifications.PermissionStatus): PushPermission {
  if (status === "granted") return "granted";
  if (status === "denied") return "denied";
  return "undetermined";
}

export async function getPushPermission(): Promise<PushPermission> {
  const { status } = await Notifications.getPermissionsAsync();
  return toPermission(status);
}

/**
 * Ask once (if never asked), then store this device's FCM token under the
 * signed-in user.
 *
 * Returns an unsubscribe for the token-refresh listener. Every failure is
 * swallowed: notifications are an enhancement, and a denied permission or an
 * offline token write must never surface on a working screen.
 */
export async function registerPushToken(uid: string): Promise<() => void> {
  try {
    await ensureChannel();

    const existing = await Notifications.getPermissionsAsync();
    const status =
      existing.status === "undetermined"
        ? (await Notifications.requestPermissionsAsync()).status
        : existing.status;
    if (toPermission(status) !== "granted") return () => {};

    const deviceId = await getDeviceId();
    const platform = Platform.OS === "ios" ? "ios" : "android";

    const write = (token: string) =>
      setDoc(pushTokenDoc(uid, deviceId), {
        token,
        platform,
        updatedAt: serverTimestamp(),
      });

    await write(await messaging().getToken());
    // FCM rotates tokens on reinstall, restore and its own schedule. Without
    // this the row goes stale and every send to it fails until FCM reports the
    // handle dead.
    return messaging().onTokenRefresh((token) => {
      void write(token).catch(console.error);
    });
  } catch (error) {
    console.error("Push registration failed", error);
    return () => {};
  }
}

/** Drop this device's row so a signed-out account stops receiving pushes. */
export async function unregisterPushToken(uid: string): Promise<void> {
  try {
    await deleteDoc(pushTokenDoc(uid, await getDeviceId()));
  } catch (error) {
    console.error("Push unregistration failed", error);
  }
}
```

- [ ] **Step 3: Write `pushRegistration.web.ts`**

```ts
/**
 * Web build: there is no FCM token to collect and no OS notification tray to
 * write to, so every entry point is an inert no-op with the same signature.
 */
export type PushPermission = "granted" | "denied" | "undetermined";

export async function getPushPermission(): Promise<PushPermission> {
  return "denied";
}

export async function registerPushToken(_uid: string): Promise<() => void> {
  return () => {};
}

export async function unregisterPushToken(_uid: string): Promise<void> {}
```

- [ ] **Step 4: Write `usePushRegistration.ts`**

```ts
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import {
  getPushPermission,
  registerPushToken,
  type PushPermission,
} from "./pushRegistration";

/**
 * Register this device once the user is signed in and active.
 *
 * Mounted from the dashboards rather than the root layout so the OS prompt
 * lands on a screen that explains itself — and never in front of the sign-in
 * form, where iOS's one-shot prompt would be spent on a stranger.
 */
export function usePushRegistration(): void {
  const { session, status } = useAuth();
  const uid = session?.id ?? null;

  useEffect(() => {
    if (!uid || status !== "active") return;
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void registerPushToken(uid).then((off) => {
      if (cancelled) off();
      else unsubscribe = off;
    });
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [uid, status]);
}

/** The current OS permission, for the Settings row. */
export function usePushPermission(): { status: PushPermission | "loading" } {
  const [status, setStatus] = useState<PushPermission | "loading">("loading");
  useEffect(() => {
    let active = true;
    void getPushPermission().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, []);
  return { status };
}
```

- [ ] **Step 5: Drop the token on sign-out**

`signOut` is currently the one-liner `signOut: () => fbSignOut(auth),` inside the `useMemo` value at `src/lib/auth/AuthProvider.tsx:119`. Replace it with a version that drops this device's row **first** — the owner-only rule on `users/{uid}/pushTokens` rejects the delete the moment the credential is gone.

Add the import:

```ts
import { unregisterPushToken } from "@/lib/notifications/pushRegistration";
```

and change that line to:

```ts
      // Before `fbSignOut`: once the credential is gone the owner-only rule
      // rejects the delete, and this device would keep receiving pushes for an
      // account that is no longer signed in on it.
      signOut: async () => {
        if (firebaseUser) await unregisterPushToken(firebaseUser.uid);
        await fbSignOut(auth);
      },
```

`firebaseUser` is already in that `useMemo`'s dependency array (`[firebaseUser, session, loading, initializing, refreshSession]`), so the array needs no change.

- [ ] **Step 6: Call it from the dashboard**

In `src/components/screens/DashboardScreen.tsx`, add the import and one call at the top of the component, before the existing `useRegionFilter()` line:

```ts
import { usePushRegistration } from "@/lib/notifications/usePushRegistration";
```

```ts
}: Props) {
  // Both roles land here first after signing in, so this is where the OS
  // permission prompt gets its context.
  usePushRegistration();
  const { region, ready } = useRegionFilter();
```

- [ ] **Step 7: Add the Settings row for a denied permission**

In `src/components/form/SettingsList.tsx`, add the imports:

```ts
import { usePushPermission } from "@/lib/notifications/usePushRegistration";
import { Linking } from "react-native";
```

read the permission alongside the région:

```ts
  const { region, setRegion } = useRegionFilter();
  const { status: pushStatus } = usePushPermission();
```

and render one section, immediately after the `Région gérée` dropdown block:

```tsx
      {pushStatus === "denied" ? (
        <Section title="Notifications désactivées">
          <Button
            variant="outlined"
            label="Ouvrir les réglages"
            onPress={() => void Linking.openSettings()}
          />
        </Section>
      ) : null}
```

Shown only when denied: a granted permission needs no row, and an undetermined one is about to be prompted for on the dashboard.

- [ ] **Step 8: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green. No test imports `@react-native-firebase/*` — the only tested module in `src/lib/notifications/` is the pure `notificationRouting.ts` (Task 9). If a future test does pull it in, Jest will fail on untransformed ESM and `@react-native-firebase` needs adding to `transformIgnorePatterns` in `package.json`; do not add it pre-emptively.

- [ ] **Step 9: Verify on a device**

```bash
npx expo run:android
```

Sign in, accept the permission prompt, then check the token landed:

```bash
JAVA_HOME=/usr/local/jdk-26.0.1 npx firebase-tools@latest firestore:get "users" --database bike-eco-db --project bike-eco-43a84 2>/dev/null | head -20
```

Or read `users/{uid}/pushTokens` in the Firebase console. Expected: one document whose `token` is a long FCM string. Sign out and confirm it disappears.

- [ ] **Step 10: Commit**

```bash
git add src/lib/notifications src/lib/auth/AuthProvider.tsx src/components/screens/DashboardScreen.tsx src/components/form/SettingsList.tsx
git commit -m "feat: register FCM push tokens and prompt for permission"
```

---

### Task 9: Notification tap routing

**Files:**
- Create: `src/lib/notifications/notificationRouting.ts`
- Create: `src/lib/notifications/useNotificationRouting.ts`
- Create: `src/lib/notifications/useNotificationRouting.web.ts`
- Modify: `src/app/_layout.tsx`
- Test: `src/lib/notifications/__tests__/notificationRouting.test.ts`

**Interfaces:**
- Consumes: `UserRole` from `@/lib/firestore/schema`
- Produces: `resolveRoute(data: Record<string, unknown> | undefined, role: UserRole): string | null`
- Produces: `useNotificationRouting(): void`

- [ ] **Step 1: Write the failing test**

Create `src/lib/notifications/__tests__/notificationRouting.test.ts`:

```ts
import { expect, test } from "@jest/globals";
import { resolveRoute } from "@/lib/notifications/notificationRouting";

test("a dossier target routes into the viewer's own group", () => {
  expect(resolveRoute({ kind: "dossier", dossierId: "dos_1" }, "b2b")).toBe(
    "/(b2b)/dossier/dos_1",
  );
  expect(resolveRoute({ kind: "dossier", dossierId: "dos_1" }, "backoffice")).toBe(
    "/(backoffice)/dossier/dos_1",
  );
});

test("a chat target routes to the dossier's chat tab", () => {
  expect(resolveRoute({ kind: "chat", dossierId: "dos_1" }, "b2b")).toBe(
    "/(b2b)/dossier/dos_1/chat",
  );
  expect(resolveRoute({ kind: "chat", dossierId: "dos_1" }, "backoffice")).toBe(
    "/(backoffice)/dossier/dos_1/chat",
  );
});

test("a company target is back-office only", () => {
  expect(resolveRoute({ kind: "company", companyId: "comp_1" }, "backoffice")).toBe(
    "/(backoffice)/companies/comp_1",
  );
  // A b2b user has no companies route; routing there would 404 the app.
  expect(resolveRoute({ kind: "company", companyId: "comp_1" }, "b2b")).toBeNull();
});

test("an unknown or malformed payload is ignored rather than throwing", () => {
  expect(resolveRoute(undefined, "b2b")).toBeNull();
  expect(resolveRoute({}, "b2b")).toBeNull();
  expect(resolveRoute({ kind: "banana", dossierId: "dos_1" }, "b2b")).toBeNull();
  expect(resolveRoute({ kind: "dossier" }, "b2b")).toBeNull();
  expect(resolveRoute({ kind: "dossier", dossierId: 42 }, "b2b")).toBeNull();
  expect(resolveRoute({ kind: "company" }, "backoffice")).toBeNull();
});

test("an empty id is treated as missing", () => {
  expect(resolveRoute({ kind: "dossier", dossierId: "" }, "b2b")).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest src/lib/notifications/__tests__/notificationRouting.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `notificationRouting.ts`**

```ts
import type { UserRole } from "@/lib/firestore/schema";

/**
 * Turn an FCM `data` block into an in-app route.
 *
 * The payload names a *logical* target ("this dossier"), never a route: the
 * same notification is delivered to a b2b user and to the back office, whose
 * dossier screens live in different route groups. Resolving here means the
 * server never has to know which group the recipient belongs to.
 *
 * Every value arrives as a string (FCM data is string-only) from a source
 * outside this process, so each one is validated rather than trusted.
 */
export function resolveRoute(
  data: Record<string, unknown> | undefined,
  role: UserRole,
): string | null {
  if (!data) return null;
  const id = (key: string): string | null => {
    const value = data[key];
    return typeof value === "string" && value !== "" ? value : null;
  };
  const group = role === "backoffice" ? "(backoffice)" : "(b2b)";

  switch (data.kind) {
    case "company": {
      // Only the back office has a companies route.
      const companyId = id("companyId");
      return role === "backoffice" && companyId
        ? `/(backoffice)/companies/${companyId}`
        : null;
    }
    case "dossier": {
      const dossierId = id("dossierId");
      return dossierId ? `/${group}/dossier/${dossierId}` : null;
    }
    case "chat": {
      const dossierId = id("dossierId");
      return dossierId ? `/${group}/dossier/${dossierId}/chat` : null;
    }
    default:
      return null;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest src/lib/notifications/__tests__/notificationRouting.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Write `useNotificationRouting.ts`**

```ts
import messaging, {
  type FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { resolveRoute } from "./notificationRouting";

/**
 * Navigate when the user taps a notification.
 *
 * Two entry points, both required: `onNotificationOpenedApp` for a tap while
 * the app is backgrounded, and `getInitialNotification` for the cold start,
 * where the tap is what launched the process and there is no listener yet.
 *
 * A cold-start tap resolves before the session does. Navigating then would be
 * undone by AuthGate's redirect to sign-in, so the payload is parked and
 * replayed once the session is active.
 *
 * Parked in *state*, not a ref: a ref write does not re-render, so a tap
 * arriving while the session is already active would sit there and never be
 * consumed by the effect below.
 */
export function useNotificationRouting(): void {
  const router = useRouter();
  const { session, status } = useAuth();
  const role = session?.role ?? null;
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const handle = (message: FirebaseMessagingTypes.RemoteMessage | null) => {
      if (message?.data) setPending(message.data);
    };
    void messaging().getInitialNotification().then(handle);
    return messaging().onNotificationOpenedApp(handle);
  }, []);

  useEffect(() => {
    if (!pending || !role || status !== "active") return;
    const route = resolveRoute(pending, role);
    // Cleared whether or not it resolved: an unroutable payload must not be
    // retried on every session change for the rest of the process.
    setPending(null);
    if (route) router.push(route as Href);
  }, [pending, role, status, router]);
}
```

`resolveRoute` builds its path from a runtime id, which typed routes cannot verify — hence the single `as Href`. It is the only cast in this feature; do not add others.

- [ ] **Step 6: Write `useNotificationRouting.web.ts`**

```ts
/** Web build: no notifications to be tapped. */
export function useNotificationRouting(): void {}
```

- [ ] **Step 7: Mount it inside `AuthGate`**

In `src/app/_layout.tsx`, add the import and one call inside `AuthGate` — it must be *inside*, so `useAuth()` resolves:

```ts
import { useNotificationRouting } from "@/lib/notifications/useNotificationRouting";
```

```tsx
function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, initializing, session, status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Inside the gate, not around it: a cold-start tap has to wait for the
  // session before it can pick a route group.
  useNotificationRouting();
```

- [ ] **Step 8: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/notifications "src/app/_layout.tsx"
git commit -m "feat: route notification taps to the right screen"
```

---

### Task 10: Foreground presentation

**Files:**
- Create: `src/lib/notifications/useForegroundNotifications.ts`
- Create: `src/lib/notifications/useForegroundNotifications.web.ts`
- Modify: `src/app/_layout.tsx`

**Interfaces:**
- Consumes: `resolveRoute` (Task 9), `useAuth`
- Produces: `useForegroundNotifications(): void`

- [ ] **Step 1: Write `useForegroundNotifications.ts`**

```ts
import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { usePathname } from "expo-router";
import { useEffect, useRef } from "react";

import { useAuth } from "@/lib/auth/AuthProvider";
import { resolveRoute } from "./notificationRouting";

/**
 * FCM hands a foreground message straight to the app without drawing anything,
 * so the banner has to be presented here or it is simply lost.
 *
 * Suppressed when the user is already looking at what the notification is
 * about — being banner-pinged for the chat thread you are actively reading is
 * the fastest way to get notifications turned off.
 */
export function useForegroundNotifications(): void {
  const pathname = usePathname();
  const { session } = useAuth();
  const role = session?.role ?? null;
  // The listener is registered once; a ref keeps it reading the live route
  // instead of the one captured at subscribe time.
  const current = useRef({ pathname, role });
  useEffect(() => {
    current.current = { pathname, role };
  });

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    return messaging().onMessage(async (message) => {
      const { pathname: here, role: viewer } = current.current;
      const target = viewer ? resolveRoute(message.data, viewer) : null;
      // `usePathname` reports the resolved path without the group segment
      // ("/dossier/dos_1/chat"), while resolveRoute includes it — compare on
      // the suffix rather than for equality.
      if (target && here && target.endsWith(here)) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: message.notification?.title ?? "",
          body: message.notification?.body ?? "",
          data: message.data ?? {},
        },
        trigger: null,
      });
    });
  }, []);
}
```

- [ ] **Step 2: Write `useForegroundNotifications.web.ts`**

```ts
/** Web build: no foreground FCM stream to present. */
export function useForegroundNotifications(): void {}
```

- [ ] **Step 3: Mount it next to the routing hook**

In `src/app/_layout.tsx`:

```ts
import { useForegroundNotifications } from "@/lib/notifications/useForegroundNotifications";
```

```tsx
  useNotificationRouting();
  useForegroundNotifications();
```

- [ ] **Step 4: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green.

- [ ] **Step 5: Verify end-to-end on a device**

With the Android dev client running and signed in as a back-office user, have a b2b account send a chat message (or write a message document directly via the emulator). Expected: a banner appears while the app is foregrounded, tapping it lands on that dossier's chat, and no banner appears if you are already on that chat screen.

- [ ] **Step 6: Commit**

```bash
git add src/lib/notifications "src/app/_layout.tsx"
git commit -m "feat: present notifications received in the foreground"
```

---

### Task 11: The per-dossier subscription toggle

**Files:**
- Create: `src/components/ui/IconButton.tsx`
- Modify: `src/components/ui/InfoContactRow.tsx:63-82`
- Modify: `src/components/ui/PhotoCarousel.tsx`
- Create: `src/lib/data/useDossierMute.ts`
- Create: `src/components/ui/DossierMuteButton.tsx`
- Modify: `src/components/screens/DossierDetailScreen.tsx:98-118`

**Interfaces:**
- Consumes: `dossierMuteDoc` (Task 2), `useAccount`
- Produces:
  - `IconButton({ icon, accessibilityLabel, onPress, disabled? })` — the shared brand-tint icon button
  - `useDossierMute(dossierId): { muted: boolean; toggle: () => void; ready: boolean }`
  - `PhotoCarousel` gains an optional `topLeft?: ReactNode` prop

- [ ] **Step 1: Extract the shared icon button**

Create `src/components/ui/IconButton.tsx`:

```tsx
import { Image } from "expo-image";
import { Pressable, StyleSheet } from "react-native";

import { tokens } from "@/theme/tokens";

/**
 * The app's one icon-only action button: the phone/email buttons in
 * `InfoContactRow` and the subscription bell over the dossier carousel.
 *
 * Filled with the brand green, not outlined: a hairline box around a dark glyph
 * read as a disabled placeholder rather than the row's one action.
 * Charcoal-on-green is the logo's own pairing, and 6.3:1.
 */
export default function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled,
}: {
  /** A required SVG module, e.g. `require("@/assets/images/icons/phone.svg")`. */
  icon: number;
  /** Icon-only, so without this the button is unreachable by a screen reader. */
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Image
        source={icon}
        style={styles.icon}
        tintColor={tokens.colors.primary}
        contentFit="contain"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: tokens.space.md,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.brandTint,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  pressed: { backgroundColor: tokens.colors.brandPressed },
  disabled: { opacity: 0.5 },
  icon: { width: 22, height: 22 },
});
```

`icon: number` is the right type: `types/assets.d.ts` declares `*.svg` as `const asset: number`, because Metro resolves an image import to an asset-registry number.

- [ ] **Step 2: Use it in `InfoContactRow`**

Replace the inline `<Pressable>…</Pressable>` block with the shared button, and drop the now-unused `button` / `pressed` / `icon` styles and the `Image` / `Pressable` imports:

```tsx
      {url ? (
        <IconButton
          icon={icon}
          accessibilityLabel={a11y(value!)}
          onPress={open}
        />
      ) : null}
```

Add `import IconButton from "./IconButton";` and keep everything else in the file — the `Linking.canOpenURL` comment above `open` is load-bearing.

- [ ] **Step 3: Add the `topLeft` slot to `PhotoCarousel`**

```tsx
export default function PhotoCarousel({
  photos,
  status,
  topLeft,
}: {
  photos: string[];
  status?: DossierStatus;
  /** Overlaid opposite the status badge. Used for the subscription toggle. */
  topLeft?: ReactNode;
}) {
```

Add `import type { ReactNode } from "react";`, render the slot next to the badge:

```tsx
      {topLeft ? <View style={styles.topLeft}>{topLeft}</View> : null}
      {status ? (
        <View style={styles.badge}>
          <StatusBadge status={status} />
        </View>
      ) : null}
```

and add the style beside `badge`:

```ts
  topLeft: { position: "absolute", top: tokens.space.md, left: tokens.space.md },
```

- [ ] **Step 4: Write `useDossierMute.ts`**

Create `src/lib/data/useDossierMute.ts`:

```ts
import { deleteDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";

import { useAccount } from "@/lib/data/useAccount";
import { dossierMuteDoc } from "@/lib/firestore/collections";

/**
 * Whether this user has muted a dossier's notifications.
 *
 * Presence of `dossiers/{id}/mutes/{uid}` means muted; absence means
 * subscribed. Modelling it as an opt-out is what makes "subscribed by default"
 * need no backfill and no write at dossier creation.
 *
 * Optimistic on toggle: the bell has to flip under the finger, and a failed
 * write is a preference that did not stick — the live snapshot will correct it.
 */
export function useDossierMute(dossierId: string) {
  const { data: session } = useAccount();
  const uid = session?.id ?? null;
  const [muted, setMuted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid || !dossierId) return;
    setReady(false);
    return onSnapshot(
      dossierMuteDoc(dossierId, uid),
      (snap) => {
        setMuted(snap.exists());
        setReady(true);
      },
      (error) => {
        console.error("Mute listener failed", error);
        setReady(true);
      },
    );
  }, [uid, dossierId]);

  const toggle = useCallback(() => {
    if (!uid || !dossierId || !ready) return;
    const next = !muted;
    setMuted(next);
    const ref = dossierMuteDoc(dossierId, uid);
    const write = next
      ? setDoc(ref, { createdAt: serverTimestamp() })
      : deleteDoc(ref);
    void write.catch(console.error);
  }, [uid, dossierId, muted, ready]);

  return { muted, toggle, ready };
}
```

- [ ] **Step 5: Write `DossierMuteButton.tsx`**

Create `src/components/ui/DossierMuteButton.tsx`:

```tsx
import bellOffIcon from "@/assets/images/icons/bell-off.svg";
import bellRingIcon from "@/assets/images/icons/bell-ring.svg";
import IconButton from "@/components/ui/IconButton";
import { useDossierMute } from "@/lib/data/useDossierMute";

/**
 * Subscription toggle over the dossier carousel. Bell-ring = subscribed (the
 * default), bell-off = muted.
 */
export default function DossierMuteButton({ dossierId }: { dossierId: string }) {
  const { muted, toggle, ready } = useDossierMute(dossierId);
  return (
    <IconButton
      icon={muted ? bellOffIcon : bellRingIcon}
      accessibilityLabel={
        muted
          ? "Réactiver les notifications de ce dossier"
          : "Désactiver les notifications de ce dossier"
      }
      onPress={toggle}
      // Until the snapshot lands the icon is a guess; tapping it would write
      // the wrong state.
      disabled={!ready}
    />
  );
}
```

- [ ] **Step 6: Wire it into the dossier screen**

In `src/components/screens/DossierDetailScreen.tsx`, add the import and pass the slot. `LoadedDossier` needs the dossier id, which the screen already has — thread it through:

```tsx
import DossierMuteButton from "@/components/ui/DossierMuteButton";
```

```tsx
function LoadedDossier({
  id,
  dossier,
  role,
}: {
  id: string;
  dossier: Dossier;
  role: UserRole;
}) {
  // Projected once here: the badge over the carousel and the "Statut" row must
  // never disagree about what this role is shown.
  const status = viewerStatus(dossier.status, role);
  return (
    <>
      <PhotoCarousel
        photos={dossier.photos}
        status={status}
        topLeft={<DossierMuteButton dossierId={id} />}
      />
```

and at the call site:

```tsx
        <LoadedDossier id={id} dossier={data} role={role} />
```

- [ ] **Step 7: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green.

- [ ] **Step 8: Verify on a device**

```bash
npx expo run:android
```

Open a dossier as each role. Expected: a bell-ring button top-left of the carousel, opposite the status badge; tapping flips it to bell-off and back; the state survives a screen re-entry and an app restart.

- [ ] **Step 9: Commit**

```bash
git add src/components src/lib/data/useDossierMute.ts
git commit -m "feat: per-dossier notification subscription toggle"
```

---

### Task 12: Documentation

**Files:**
- Create: `docs/specs/feature-push-notifications.md`
- Modify: `docs/specs/page-dossier.md`
- Modify: `docs/specs/page-settings.md`
- Modify: `docs/specs/page-dossier-management.md`
- Modify: `docs/specs/component-info-card.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: everything built in Tasks 1-11
- Produces: nothing consumed by code

- [ ] **Step 1: Write the feature spec**

Create `docs/specs/feature-push-notifications.md` containing, in this order:

1. A one-paragraph summary: five events, two roles, FCM direct via `firebase-admin`, client on `@react-native-firebase/messaging` + `expo-notifications`.
2. The **event → recipients** table copied verbatim from §3 of `docs/superpowers/specs/2026-08-08-push-notifications-design.md`, including the "active means `status === 'active'`" line and both resolved readings (b2b hears only from Bike-eco; back-office subscription is scoped to `notificationRegion`).
3. The **copy** table copied verbatim from §3 of the design, with the `motoLabel` rule stated above it.
4. A short "Data" section listing the four model additions from §2 with one line each.
5. A "Gotchas" section with exactly these three: triggers must pass `database: "bike-eco-db"`; triggers run `retry: false`; `STATUS_LABELS` and `euros` are duplicated in `functions/src/notifications/labels.ts` and must be kept in sync with `src/lib/ui/format.ts`.

- [ ] **Step 2: Update `page-dossier.md`**

Add the subscription toggle to the carousel description: a bell button in the **top-left** corner, opposite the status badge, using the same icon-button treatment as the contact rows. Bell-ring = subscribed (the default), bell-off = muted. Present for both roles. Disabled until the mute state has loaded.

- [ ] **Step 3: Update `page-settings.md`**

Two changes: the "Région gérée" dropdown now persists to `users/{uid}.notificationRegion` (account-level, shared across devices) instead of device-local storage, and drives notification fan-out as well as the dashboard filter. And a "Notifications désactivées" section with an "Ouvrir les réglages" button appears only when the OS permission is denied.

- [ ] **Step 4: Update `page-dossier-management.md`**

Note that the update writes `updatedBy` with the caller's uid alongside `status` / `region` / `validatedPrice` / `updatedAt`, and why: the notification trigger reads it to skip the member who made the change.

- [ ] **Step 5: Update `component-info-card.md`**

Note that the contact row's action button is now the shared `IconButton`, also used by the dossier subscription toggle.

- [ ] **Step 6: List the new spec in `AGENTS.md`**

Under the page/component spec list, add:

```markdown
  - `feature-push-notifications.md` — the five push events, who receives each,
    and the exact French copy. Read before touching `functions/src/notifications/`
    or `src/lib/notifications/`.
```

- [ ] **Step 7: Run the gate**

```bash
npx tsc --noEmit && npx expo lint && npm test
```

Expected: all green (docs-only, but confirms nothing regressed).

- [ ] **Step 8: Commit**

```bash
git add docs AGENTS.md
git commit -m "docs: push notification feature spec and page spec updates"
```

---

## Final verification

After Task 12, run the full gate from a clean state:

```bash
npx tsc --noEmit && npx expo lint && npm test
cd functions && npx tsc --noEmit && npm test && npm run lint && cd ..
JAVA_HOME=/usr/local/jdk-26.0.1 npm run test:rules
```

Then deploy the triggers and confirm all four appear:

```bash
JAVA_HOME=/usr/local/jdk-26.0.1 npx firebase-tools@latest deploy --only functions --project bike-eco-43a84
```

Expected: `onCompanyCreated`, `onDossierCreated`, `onDossierMessageCreated` and `onDossierUpdated` all deploy. Verify each is bound to `bike-eco-db` in the Firebase console under Functions → Trigger.

## Known follow-ups (out of scope)

- **App Check on the callables** is still open from the launch-hardening list and is unaffected by this work.
- **Push receipts** are not polled. `firebase-admin` reports per-token failures synchronously, which covers the dead-token case; there is no deferred-receipt equivalent to check.
- **Badge counts** are not implemented — `shouldSetBadge` is `false` and nothing tracks unread state.
