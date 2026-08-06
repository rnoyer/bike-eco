# Frontend Pages Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold every B2B and Back-office _page_ (plus shared sign-in) with a native-first component strategy (`@expo/ui` + `expo-router` NativeTabs), reading from a swappable mock data layer.

**Architecture:** Two `expo-router` route groups (`(b2b)`, `(backoffice)`) of thin route files that compose shared components. List/form/settings-shaped UI uses `@expo/ui` universal components (real SwiftUI/Compose); genuinely custom layouts (photo carousel, dossier card, chat) use React Native + `StyleSheet` against extracted theme tokens. All data comes from `src/lib/data/*` hooks backed by typed fixtures, so swapping to real Firestore later never touches a component.

**Tech Stack:** Expo SDK 56, expo-router (Stack + `unstable-native-tabs`), `@expo/ui` ~56, `react-hook-form` (existing forms only — not this pass), `expo-image`, `expo-symbols`, `expo-sqlite/kv-store` (persistence), `jest-expo` + `@testing-library/react-native` (logic tests only).

## Global Constraints

- **Native-first, cross-platform (iOS + Android).** Prefer `@expo/ui` universal components and `expo-router` native chrome. Drop to RN + `StyleSheet` only where no native universal primitive exists (carousel, dossier card, chat).
- **Out of scope:** real Firebase Auth/session/rules, all multi-step form _funnels_ (B2B submission, registration), real file upload, real message send, thumbnail generation. Stub these.
- **Mock data only:** every page reads `src/lib/data/*` hooks returning `{ data, loading }` (or `{ data, loading, error }`). Types come from `src/lib/firestore/schema.ts` — do not redefine domain types.
- **UI copy is French and exact.** Use the wording from `docs/specs/*` verbatim (e.g. empty-state messages, button labels).
- **Region filter (back-office only):** dropdown label `"Région géré"`; options `"Moitié Nord"` → `NORTH`, `"Moitié sud"` → `SOUTH`, `"Toute la France"` → all (default). Persisted via `expo-sqlite/kv-store`, restored on restart. `Region = "NORTH" | "SOUTH"` already exists in `schema.ts`; "all" is represented as `null`.
- **Theme tokens** come from one module (`src/theme/tokens.ts`) extracted from the b2c StyleSheets: `primary #111`, `muted #71727A`, `border #E5E7EB`, `divider #F3F4F6`, `disabled #C1C1C6`, surface `#fff`, radius `12`, button height `52`, screen padding `24`.
- **Testing reality:** `@expo/ui` and NativeTabs render native views that do not mount in jest/jsdom. Therefore **only pure logic and hooks are unit-tested** (data layer, region filter, helpers). UI components and route files are verified with `npx tsc --noEmit` + `npx expo lint` + a manual run checklist. Do not write render assertions against `@expo/ui` trees.
- **Do not modify** `src/app/index.tsx` landing card design, `src/app/b2cSubmissionForm.tsx`, or `src/features/b2c-submission/*` except where a task explicitly says so.

---

## File Structure

```
src/theme/tokens.ts                      # extracted design tokens
src/lib/data/
  fixtures.ts                            # sample Company/AppUser/Dossier/Message
  filter.ts                              # filterDossiersByRegion + selectByStatus (pure)
  region-store.ts                        # kv-store read/write for the region filter
  useSession.ts                          # { role, user, setRole } (stub + dev switcher)
  useRegionFilter.ts                     # persisted BO region setting
  useDossiers.ts                         # list per section, optional region filter
  useDossier.ts                          # single dossier
  useMessages.ts                         # message list
  useAccount.ts                          # current user
  useDossierMutations.ts                 # stub update/send/invite
src/lib/navigation/
  headerOptions.ts                       # Stack header (navbar) helper
  regionOptions.ts                       # REGION_OPTIONS for the picker
src/components/ui/
  StatusBadge.tsx
  DossierCard.tsx
  DossiersSection.tsx
  PhotoCarousel.tsx
  ConfirmationView.tsx
  ThirdPartyAuthButtons.tsx
  chat/ChatThread.tsx
  chat/ChatComposer.tsx
src/components/native/                   # @expo/ui (Host-wrapped) building blocks
  AccountInfoList.tsx
  SettingsList.tsx
  DossierInfoList.tsx
  DossierManagementForm.tsx
  SignInFields.tsx
  AddColleagueForm.tsx
src/app/
  (auth)/_layout.tsx, signin.tsx
  (b2b)/_layout.tsx
  (b2b)/(tabs)/_layout.tsx, dashboard.tsx, account.tsx, settings.tsx
  (b2b)/add-colleague.tsx, confirmation.tsx
  (b2b)/dossier/[id]/_layout.tsx, index.tsx, chat.tsx
  (backoffice)/_layout.tsx
  (backoffice)/(tabs)/_layout.tsx, dashboard.tsx, account.tsx, settings.tsx
  (backoffice)/confirmation.tsx
  (backoffice)/dossier/[id]/_layout.tsx, index.tsx, chat.tsx, management.tsx
```

---

## Task 1: Project setup — deps, test runner, theme tokens

**Files:**

- Modify: `package.json` (deps + jest config + scripts)
- Create: `jest.setup.js`
- Create: `src/theme/tokens.ts`
- Test: `src/theme/__tests__/tokens.test.ts`

**Interfaces:**

- Produces: `tokens` object → `tokens.colors.{primary,primaryText,muted,border,divider,disabled,surface,bg,danger}`, `tokens.radius.md`, `tokens.space.{xs,sm,md,lg,xl}`, `tokens.button.height`, `tokens.text.{title,subtitle}`.

- [ ] **Step 1: Install runtime + dev dependencies**

Run:

```bash
npx expo install expo-sqlite
npm i -D jest-expo jest @testing-library/react-native react-test-renderer
```

Expected: packages added to `package.json`; `expo-sqlite` pinned to the SDK-56 version.

- [ ] **Step 2: Add jest config + scripts to `package.json`**

Add under the root object (merge, do not remove existing keys):

```json
"scripts": {
  "test": "jest"
},
"jest": {
  "preset": "jest-expo",
  "setupFilesAfterEnv": ["<rootDir>/jest.setup.js"],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))"
  ]
}
```

(Keep the existing `start`/`android`/`ios`/`web`/`lint` scripts; add `test` alongside.)

- [ ] **Step 3: Create `jest.setup.js`**

```js
// Silences the native-animation warning and provides a default kv-store mock
// fallback. Individual tests override the kv-store mock as needed.
jest.mock("expo-sqlite/kv-store", () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
      setItem: jest.fn(async (k, v) => void store.set(k, v)),
      removeItem: jest.fn(async (k) => void store.delete(k)),
    },
  };
});
```

- [ ] **Step 4: Write the failing test for tokens**

`src/theme/__tests__/tokens.test.ts`:

```ts
import { tokens } from "@/theme/tokens";

test("exposes the b2c-derived palette and metrics", () => {
  expect(tokens.colors.primary).toBe("#111");
  expect(tokens.colors.muted).toBe("#71727A");
  expect(tokens.colors.border).toBe("#E5E7EB");
  expect(tokens.radius.md).toBe(12);
  expect(tokens.button.height).toBe(52);
  expect(tokens.space.lg).toBe(24);
});
```

- [ ] **Step 5: Run it to confirm it fails**

Run: `npm test -- tokens`
Expected: FAIL — cannot find module `@/theme/tokens`.

- [ ] **Step 6: Implement `src/theme/tokens.ts`**

```ts
/** Design tokens extracted from the b2c StyleSheets — the one source of truth
 *  for the RN-fallback components. @expo/ui screens use native styling. */
export const tokens = {
  colors: {
    primary: "#111",
    primaryText: "#fff",
    muted: "#71727A",
    border: "#E5E7EB",
    divider: "#F3F4F6",
    disabled: "#C1C1C6",
    surface: "#fff",
    bg: "#fff",
    danger: "#DC2626",
  },
  radius: { sm: 8, md: 12, lg: 16 },
  space: { xs: 4, sm: 8, md: 12, lg: 24, xl: 28 },
  button: { height: 52 },
  text: {
    title: { fontSize: 24, fontWeight: "bold" as const, color: "#111" },
    subtitle: { fontSize: 14, fontWeight: "400" as const, color: "#71727A" },
  },
} as const;

export type Tokens = typeof tokens;
```

- [ ] **Step 7: Run the test to confirm it passes**

Run: `npm test -- tokens`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json jest.setup.js src/theme/tokens.ts src/theme/__tests__/tokens.test.ts
git commit -m "chore: add test runner, expo-sqlite, and theme tokens"
```

---

## Task 2: Mock data — fixtures + pure filters

**Files:**

- Create: `src/lib/data/fixtures.ts`
- Create: `src/lib/data/filter.ts`
- Test: `src/lib/data/__tests__/filter.test.ts`

**Interfaces:**

- Consumes: domain types from `@/lib/firestore/schema` (`Dossier`, `AppUser`, `Company`, `Message`, `DossierStatus`, `Region`).
- Produces:
  - `MOCK_COMPANIES: Company[]`, `MOCK_USERS: AppUser[]`, `MOCK_DOSSIERS: Dossier[]`, `messagesFor(dossierId: string): Message[]`. Each `Dossier` has a stable `id` via a wrapper type `WithId<T> = T & { id: string }`.
  - `selectByStatus(dossiers: WithId<Dossier>[], statuses: DossierStatus[]): WithId<Dossier>[]`
  - `filterDossiersByRegion(dossiers: WithId<Dossier>[], region: Region | null): WithId<Dossier>[]` (null → unchanged).

- [ ] **Step 1: Write the failing test**

`src/lib/data/__tests__/filter.test.ts`:

```ts
import { MOCK_DOSSIERS } from "@/lib/data/fixtures";
import { filterDossiersByRegion, selectByStatus } from "@/lib/data/filter";

test("selectByStatus keeps only requested statuses", () => {
  const out = selectByStatus(MOCK_DOSSIERS, ["a_traiter"]);
  expect(out.length).toBeGreaterThan(0);
  expect(out.every((d) => d.status === "a_traiter")).toBe(true);
});

test("filterDossiersByRegion null returns all", () => {
  expect(filterDossiersByRegion(MOCK_DOSSIERS, null)).toHaveLength(
    MOCK_DOSSIERS.length,
  );
});

test("filterDossiersByRegion NORTH keeps only NORTH", () => {
  const out = filterDossiersByRegion(MOCK_DOSSIERS, "NORTH");
  expect(out.length).toBeGreaterThan(0);
  expect(out.every((d) => d.region === "NORTH")).toBe(true);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- filter`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `src/lib/data/fixtures.ts`**

```ts
import { Timestamp } from "firebase/firestore";
import type {
  AppUser,
  Company,
  Dossier,
  Message,
} from "@/lib/firestore/schema";

export type WithId<T> = T & { id: string };

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));
const PHOTO = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`;
const THUMB = (seed: string) => `https://picsum.photos/seed/${seed}/200/150`;

export const MOCK_COMPANIES: WithId<Company>[] = [
  {
    id: "comp_nord",
    siret: "12345678900011",
    name: "Garage du Nord",
    status: "active",
    createdBy: "user_b2b_nord",
    createdAt: ts("2026-05-01"),
  },
];

export const MOCK_USERS: WithId<AppUser>[] = [
  {
    id: "user_b2b_nord",
    role: "b2b",
    companyId: "comp_nord",
    region: null,
    nom: "Durand",
    prenom: "Camille",
    email: "camille@garage-nord.fr",
    telephone: "0601020304",
    departement: "75 - Paris",
    ville: "Paris",
    status: "active",
    createdAt: ts("2026-05-01"),
    updatedAt: ts("2026-05-01"),
  },
  {
    id: "user_bo",
    role: "backoffice",
    companyId: null,
    region: "NORTH",
    nom: "Martin",
    prenom: "Alex",
    email: "alex@bike-eco.fr",
    telephone: "0605060708",
    departement: "45 - Loiret",
    ville: "Montargis",
    status: "active",
    createdAt: ts("2026-04-01"),
    updatedAt: ts("2026-04-01"),
  },
];

const baseVehicle = {
  electrique: "non" as const,
  materiel: [] as string[],
  marque: "Yamaha",
  modele: "MT-07",
  cylindree: 689,
  annee: 2019,
  kilometrage: 18450,
  accessoires: "Sabot moteur, top-case",
};

const emptyKeys = {
  aClesContact: "oui" as const,
  cleNoire: 2,
  cleMarron: 0,
  cleRouge: 0,
  aTelecommande: "non" as const,
  telecommande: null,
};

const okPapers = {
  carteGrise: "oui" as const,
  carteGriseAVotreNom: "oui" as const,
  controleTechnique: "oui" as const,
  ctMoins6Mois: "oui" as const,
  resultatCT: "Favorable" as const,
  certificatNonGage: "oui" as const,
  carnetEntretien: "oui" as const,
  factureEntretien: "non" as const,
};

function makeDossier(
  id: string,
  status: Dossier["status"],
  region: Dossier["region"],
  marque: string,
  modele: string,
): WithId<Dossier> {
  return {
    id,
    status,
    region,
    companyId: "comp_nord",
    submittedBy: "user_b2b_nord",
    assignedTo: null,
    negotiatedPrice: status === "cloture" ? 4200 : null,
    submitter: {
      nom: "Durand",
      prenom: "Camille",
      companyName: "Garage du Nord",
    },
    vehicle: { ...baseVehicle, marque, modele },
    keys: emptyKeys,
    condition: { etat: "Bon état", naturePanne: "" },
    papers: okPapers,
    pricing: { prix: 5000, commentaires: "Première main, entretien suivi." },
    photos: [PHOTO(id + "a"), PHOTO(id + "b"), PHOTO(id + "c")],
    thumbnailUrl: THUMB(id + "a"),
    createdAt: ts("2026-06-20"),
    updatedAt: ts("2026-06-21"),
    lastMessageAt: ts("2026-06-22"),
  };
}

export const MOCK_DOSSIERS: WithId<Dossier>[] = [
  makeDossier("dos_1", "a_traiter", "NORTH", "Yamaha", "MT-07"),
  makeDossier("dos_2", "en_cours", "NORTH", "Honda", "CB500F"),
  makeDossier("dos_3", "cloture", "SOUTH", "Kawasaki", "Z650"),
  makeDossier("dos_4", "a_traiter", "SOUTH", "BMW", "G310R"),
];

export function messagesFor(dossierId: string): Message[] {
  return [
    {
      senderId: "user_b2b_nord",
      senderName: "Camille Durand - Garage du Nord",
      senderRole: "b2b",
      text: "Bonjour, la moto est disponible immédiatement.",
      attachments: [],
      createdAt: ts("2026-06-22T09:00:00"),
    },
    {
      senderId: "user_bo",
      senderName: "Alex Martin - Bike-eco",
      senderRole: "backoffice",
      text: "Merci, nous revenons vers vous avec une offre.",
      attachments: [
        { type: "pdf", url: PHOTO(dossierId), name: "offre.pdf", size: 84213 },
      ],
      createdAt: ts("2026-06-22T11:30:00"),
    },
  ];
}
```

- [ ] **Step 4: Implement `src/lib/data/filter.ts`**

```ts
import type { Dossier, DossierStatus, Region } from "@/lib/firestore/schema";
import type { WithId } from "./fixtures";

export function selectByStatus(
  dossiers: WithId<Dossier>[],
  statuses: DossierStatus[],
): WithId<Dossier>[] {
  return dossiers.filter((d) => statuses.includes(d.status));
}

export function filterDossiersByRegion(
  dossiers: WithId<Dossier>[],
  region: Region | null,
): WithId<Dossier>[] {
  if (region == null) return dossiers;
  return dossiers.filter((d) => d.region === region);
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npm test -- filter`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/data/fixtures.ts src/lib/data/filter.ts src/lib/data/__tests__/filter.test.ts
git commit -m "feat(data): mock fixtures and pure dossier filters"
```

---

## Task 3: Persisted region filter + session

**Files:**

- Create: `src/lib/data/region-store.ts`
- Create: `src/lib/data/useRegionFilter.ts`
- Create: `src/lib/data/useSession.ts`
- Test: `src/lib/data/__tests__/useRegionFilter.test.ts`

**Interfaces:**

- Consumes: `Region` from `@/lib/firestore/schema`.
- Produces:
  - `loadRegion(): Promise<Region | null>`, `saveRegion(r: Region | null): Promise<void>` (key `"bo.regionFilter"`, value `"NORTH"|"SOUTH"|"ALL"`).
  - `useRegionFilter(): { region: Region | null; setRegion: (r: Region | null) => void; ready: boolean }`.
  - `useSession(): { role: UserRole; user: WithId<AppUser>; setRole: (r: UserRole) => void }` — stub; default role `"b2b"`, exposes `setRole` for the dev switcher.

- [ ] **Step 1: Write the failing test**

`src/lib/data/__tests__/useRegionFilter.test.ts`:

```ts
import { act, renderHook, waitFor } from "@testing-library/react-native";
import Storage from "expo-sqlite/kv-store";
import { useRegionFilter } from "@/lib/data/useRegionFilter";

beforeEach(() => {
  (Storage.getItem as jest.Mock).mockResolvedValue(null);
  (Storage.setItem as jest.Mock).mockClear();
});

test("defaults to null (Toute la France) and becomes ready", async () => {
  const { result } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  expect(result.current.region).toBeNull();
});

test("setRegion persists 'NORTH' to kv-store", async () => {
  const { result } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.ready).toBe(true));
  await act(async () => result.current.setRegion("NORTH"));
  expect(result.current.region).toBe("NORTH");
  expect(Storage.setItem).toHaveBeenCalledWith("bo.regionFilter", "NORTH");
});

test("restores a persisted 'SOUTH' value on mount", async () => {
  (Storage.getItem as jest.Mock).mockResolvedValue("SOUTH");
  const { result } = renderHook(() => useRegionFilter());
  await waitFor(() => expect(result.current.region).toBe("SOUTH"));
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- useRegionFilter`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/data/region-store.ts`**

```ts
import Storage from "expo-sqlite/kv-store";
import type { Region } from "@/lib/firestore/schema";

const KEY = "bo.regionFilter";

export async function loadRegion(): Promise<Region | null> {
  const raw = await Storage.getItem(KEY);
  return raw === "NORTH" || raw === "SOUTH" ? raw : null;
}

export async function saveRegion(region: Region | null): Promise<void> {
  await Storage.setItem(KEY, region ?? "ALL");
}
```

- [ ] **Step 4: Implement `src/lib/data/useRegionFilter.ts`**

```ts
import { useCallback, useEffect, useState } from "react";
import type { Region } from "@/lib/firestore/schema";
import { loadRegion, saveRegion } from "./region-store";

export function useRegionFilter() {
  const [region, setRegionState] = useState<Region | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    loadRegion().then((r) => {
      if (active) {
        setRegionState(r);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setRegion = useCallback((r: Region | null) => {
    setRegionState(r);
    void saveRegion(r);
  }, []);

  return { region, setRegion, ready };
}
```

- [ ] **Step 5: Implement `src/lib/data/useSession.ts`**

```ts
import { useState } from "react";
import type { UserRole } from "@/lib/firestore/schema";
import { MOCK_USERS, type WithId } from "./fixtures";
import type { AppUser } from "@/lib/firestore/schema";

/** Stubbed session. `setRole` flips identity so both groups are previewable. */
export function useSession() {
  const [role, setRole] = useState<UserRole>("b2b");
  const user = MOCK_USERS.find((u) => u.role === role) as WithId<AppUser>;
  return { role, user, setRole };
}
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `npm test -- useRegionFilter`
Expected: PASS (3 tests).

- [ ] **Step 7: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/lib/data/region-store.ts src/lib/data/useRegionFilter.ts src/lib/data/useSession.ts src/lib/data/__tests__/useRegionFilter.test.ts
git commit -m "feat(data): persisted region filter and stub session"
```

---

## Task 4: Read hooks + mutation stubs

**Files:**

- Create: `src/lib/data/useDossiers.ts`
- Create: `src/lib/data/useDossier.ts`
- Create: `src/lib/data/useMessages.ts`
- Create: `src/lib/data/useAccount.ts`
- Create: `src/lib/data/useDossierMutations.ts`
- Test: `src/lib/data/__tests__/useDossiers.test.ts`

**Interfaces:**

- Consumes: `MOCK_DOSSIERS`, `MOCK_USERS`, `messagesFor`, `WithId` (Task 2); `selectByStatus`, `filterDossiersByRegion` (Task 2); `useSession` (Task 3).
- Produces:
  - `useDossiers(statuses: DossierStatus[], region?: Region | null): { data: WithId<Dossier>[]; loading: boolean }`
  - `useDossier(id: string): { data: WithId<Dossier> | null; loading: boolean }`
  - `useMessages(dossierId: string): { data: Message[]; loading: boolean }`
  - `useAccount(): { data: WithId<AppUser>; loading: boolean }`
  - `useDossierMutations(): { updateStatusAndPrice(id, status, price): Promise<void>; sendMessage(id, text): Promise<void>; invite(email): Promise<void> }` (each resolves after ~300ms; no real writes).

- [ ] **Step 1: Write the failing test**

`src/lib/data/__tests__/useDossiers.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react-native";
import { useDossiers } from "@/lib/data/useDossiers";

test("starts loading then returns a_traiter dossiers", async () => {
  const { result } = renderHook(() => useDossiers(["a_traiter"]));
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data.every((d) => d.status === "a_traiter")).toBe(true);
});

test("region filter narrows the list to NORTH", async () => {
  const { result } = renderHook(() => useDossiers(["a_traiter"], "NORTH"));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.data.every((d) => d.region === "NORTH")).toBe(true);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -- useDossiers`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/data/useDossiers.ts`**

```ts
import { useEffect, useState } from "react";
import type { Dossier, DossierStatus, Region } from "@/lib/firestore/schema";
import { MOCK_DOSSIERS, type WithId } from "./fixtures";
import { filterDossiersByRegion, selectByStatus } from "./filter";

/** Simulates an async fetch so the swap to a Firestore listener is invisible. */
export function useDossiers(statuses: DossierStatus[], region?: Region | null) {
  const [data, setData] = useState<WithId<Dossier>[]>([]);
  const [loading, setLoading] = useState(true);
  const key = statuses.join(",") + "|" + (region ?? "ALL");

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const byStatus = selectByStatus(MOCK_DOSSIERS, statuses);
      const sorted = [...byStatus].sort(
        (a, b) => a.createdAt.toMillis() - b.createdAt.toMillis(),
      );
      setData(filterDossiersByRegion(sorted, region ?? null));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading };
}
```

- [ ] **Step 4: Implement `src/lib/data/useDossier.ts`**

```ts
import { useEffect, useState } from "react";
import type { Dossier } from "@/lib/firestore/schema";
import { MOCK_DOSSIERS, type WithId } from "./fixtures";

export function useDossier(id: string) {
  const [data, setData] = useState<WithId<Dossier> | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setData(MOCK_DOSSIERS.find((d) => d.id === id) ?? null);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [id]);
  return { data, loading };
}
```

- [ ] **Step 5: Implement `src/lib/data/useMessages.ts`**

```ts
import { useEffect, useState } from "react";
import type { Message } from "@/lib/firestore/schema";
import { messagesFor } from "./fixtures";

export function useMessages(dossierId: string) {
  const [data, setData] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      setData(messagesFor(dossierId));
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [dossierId]);
  return { data, loading };
}
```

- [ ] **Step 6: Implement `src/lib/data/useAccount.ts`**

```ts
import type { AppUser } from "@/lib/firestore/schema";
import { type WithId } from "./fixtures";
import { useSession } from "./useSession";

export function useAccount(): { data: WithId<AppUser>; loading: boolean } {
  const { user } = useSession();
  return { data: user, loading: false };
}
```

- [ ] **Step 7: Implement `src/lib/data/useDossierMutations.ts`**

```ts
import { useCallback } from "react";
import type { DossierStatus } from "@/lib/firestore/schema";

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** Stubbed mutations — log + resolve. Swap to Firestore writes later. */
export function useDossierMutations() {
  const updateStatusAndPrice = useCallback(
    async (id: string, status: DossierStatus, price: number | null) => {
      await delay();
      console.log("[stub] update", { id, status, price });
    },
    [],
  );
  const sendMessage = useCallback(async (id: string, text: string) => {
    await delay();
    console.log("[stub] sendMessage", { id, text });
  }, []);
  const invite = useCallback(async (email: string) => {
    await delay();
    console.log("[stub] invite", { email });
  }, []);
  return { updateStatusAndPrice, sendMessage, invite };
}
```

- [ ] **Step 8: Run tests + typecheck**

Run: `npm test -- useDossiers && npx tsc --noEmit`
Expected: PASS (2 tests); no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/data/useDossiers.ts src/lib/data/useDossier.ts src/lib/data/useMessages.ts src/lib/data/useAccount.ts src/lib/data/useDossierMutations.ts src/lib/data/__tests__/useDossiers.test.ts
git commit -m "feat(data): read hooks and mutation stubs"
```

---

## Task 5: RN dossier-list components (StatusBadge, DossierCard, DossiersSection)

**Files:**

- Create: `src/components/ui/StatusBadge.tsx`
- Create: `src/components/ui/DossierCard.tsx`
- Create: `src/components/ui/DossiersSection.tsx`

**Interfaces:**

- Consumes: `tokens` (Task 1); `WithId`, `Dossier` types; `DossierStatus`.
- Produces:
  - `StatusBadge({ status }: { status: DossierStatus })`
  - `DossierCard({ thumbnailUrl, title, subtitle, status?, onPress })`
  - `DossiersSection({ title, dossiers, loading, emptyMessage, renderCard })` where `renderCard(d: WithId<Dossier>) => ReactNode`.

- [ ] **Step 1: Implement `StatusBadge.tsx`**

```tsx
import { StyleSheet, Text, View } from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

const MAP: Record<DossierStatus, { label: string; bg: string; fg: string }> = {
  a_traiter: { label: "À traiter", bg: "#FEF3C7", fg: "#92400E" },
  en_cours: { label: "En cours", bg: "#DBEAFE", fg: "#1E40AF" },
  cloture: { label: "Clôturé", bg: "#DCFCE7", fg: "#166534" },
};

export default function StatusBadge({ status }: { status: DossierStatus }) {
  const s = MAP[status];
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.text, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radius.sm,
    alignSelf: "flex-start",
  },
  text: { fontSize: 12, fontWeight: "600" },
});
```

- [ ] **Step 2: Implement `DossierCard.tsx`**

```tsx
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import StatusBadge from "./StatusBadge";

interface Props {
  thumbnailUrl: string | null;
  title: string;
  subtitle: string;
  status?: DossierStatus;
  onPress: () => void;
}

export default function DossierCard({
  thumbnailUrl,
  title,
  subtitle,
  status,
  onPress,
}: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <Image
        source={thumbnailUrl ? { uri: thumbnailUrl } : undefined}
        style={styles.thumb}
        contentFit="cover"
        transition={150}
      />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
        {status ? <StatusBadge status={status} /> : null}
      </View>
    </TouchableOpacity>
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
  thumb: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.divider,
  },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: "600", color: tokens.colors.primary },
  subtitle: { fontSize: 13, color: tokens.colors.muted },
});
```

- [ ] **Step 3: Implement `DossiersSection.tsx`**

```tsx
import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Dossier } from "@/lib/firestore/schema";
import type { WithId } from "@/lib/data/fixtures";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  dossiers: WithId<Dossier>[];
  loading: boolean;
  emptyMessage: string;
  renderCard: (d: WithId<Dossier>) => ReactNode;
}

export default function DossiersSection({
  title,
  dossiers,
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
      ) : dossiers.length === 0 ? (
        <Text style={styles.empty}>{emptyMessage}</Text>
      ) : (
        <View style={styles.list}>{dossiers.map(renderCard)}</View>
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

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/StatusBadge.tsx src/components/ui/DossierCard.tsx src/components/ui/DossiersSection.tsx
git commit -m "feat(ui): status badge, dossier card, dossiers section"
```

---

## Task 6: PhotoCarousel + ConfirmationView

**Files:**

- Create: `src/components/ui/PhotoCarousel.tsx`
- Create: `src/components/ui/ConfirmationView.tsx`

**Interfaces:**

- Consumes: `tokens`; `expo-image`; `expo-router` `useRouter`, `Href`.
- Produces:
  - `PhotoCarousel({ photos, status }: { photos: string[]; status?: DossierStatus })` — horizontal paged images with a `StatusBadge` overlaid top-right.
  - `ConfirmationView({ title, message?, delay?, redirectTo })` where `redirectTo: Href`, `delay` default `500` (ms). Auto-redirects via `router.replace`.

- [ ] **Step 1: Implement `PhotoCarousel.tsx`**

```tsx
import { Image } from "expo-image";
import { useState } from "react";
import {
  Dimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import type { DossierStatus } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";
import StatusBadge from "./StatusBadge";

const W = Dimensions.get("window").width;

export default function PhotoCarousel({
  photos,
  status,
}: {
  photos: string[];
  status?: DossierStatus;
}) {
  const [index, setIndex] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(e.nativeEvent.contentOffset.x / W));

  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {photos.map((uri) => (
          <Image
            key={uri}
            source={{ uri }}
            style={styles.photo}
            contentFit="cover"
            transition={150}
          />
        ))}
      </ScrollView>
      {status ? (
        <View style={styles.badge}>
          <StatusBadge status={status} />
        </View>
      ) : null}
      <View style={styles.dots}>
        {photos.map((uri, i) => (
          <View
            key={uri}
            style={[styles.dot, i === index && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: W, height: W * 0.75, backgroundColor: tokens.colors.divider },
  photo: { width: W, height: W * 0.75 },
  badge: { position: "absolute", top: 12, right: 12 },
  dots: {
    position: "absolute",
    bottom: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: { backgroundColor: "#fff" },
});
```

- [ ] **Step 2: Implement `ConfirmationView.tsx`**

```tsx
import { type Href, useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  message?: string;
  delay?: number;
  redirectTo: Href;
}

export default function ConfirmationView({
  title,
  message,
  delay = 500,
  redirectTo,
}: Props) {
  const router = useRouter();
  useEffect(() => {
    const t = setTimeout(() => router.replace(redirectTo), delay);
    return () => clearTimeout(t);
  }, [router, redirectTo, delay]);

  return (
    <View style={styles.container}>
      <Text style={styles.check}>✓</Text>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: tokens.space.lg,
    gap: tokens.space.md,
    backgroundColor: tokens.colors.bg,
  },
  check: {
    fontSize: 56,
    color: "#16A34A",
    fontWeight: "bold",
  },
  title: { ...tokens.text.title, textAlign: "center" },
  message: { ...tokens.text.subtitle, textAlign: "center" },
});
```

- [ ] **Step 3: Typecheck + lint + commit**

```bash
npx tsc --noEmit && npx expo lint
git add src/components/ui/PhotoCarousel.tsx src/components/ui/ConfirmationView.tsx
git commit -m "feat(ui): photo carousel and confirmation view"
```

---

## Task 7: Chat components (ChatThread, ChatComposer)

**Files:**

- Create: `src/components/ui/chat/ChatThread.tsx`
- Create: `src/components/ui/chat/ChatComposer.tsx`

**Interfaces:**

- Consumes: `tokens`; `Message`, `MessageAttachment` types; `@expo/ui` `BottomSheet`, `Host`, `Button` for the attach menu.
- Produces:
  - `ChatThread({ messages, currentUserId }: { messages: Message[]; currentUserId: string })` — scrollable bubbles; own messages right-aligned. Each bubble shows sender name, text, attachment chips, timestamp.
  - `ChatComposer({ onSend }: { onSend: (text: string) => void })` — RN `TextInput` + `+` attach button opening a `BottomSheet` with "Photo" / "PDF" options (stub handlers; chosen option just closes the sheet for now).

- [ ] **Step 1: Implement `ChatThread.tsx`**

```tsx
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { Message, MessageAttachment } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

function timeLabel(m: Message): string {
  return m.createdAt.toDate().toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Attachment({ a }: { a: MessageAttachment }) {
  return (
    <View style={styles.attach}>
      <Text style={styles.attachIcon}>{a.type === "pdf" ? "📄" : "🖼️"}</Text>
      <Text style={styles.attachName} numberOfLines={1}>
        {a.name}
      </Text>
    </View>
  );
}

export default function ChatThread({
  messages,
  currentUserId,
}: {
  messages: Message[];
  currentUserId: string;
}) {
  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {messages.map((m, i) => {
        const mine = m.senderId === currentUserId;
        return (
          <View
            key={`${m.senderId}-${i}`}
            style={[styles.row, mine ? styles.rowMine : styles.rowТheirs]}
          >
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.sender, mine && styles.senderMine]}>
                {m.senderName}
              </Text>
              {m.text ? (
                <Text style={[styles.text, mine && styles.textMine]}>
                  {m.text}
                </Text>
              ) : null}
              {m.attachments.map((a) => (
                <Attachment key={a.url} a={a} />
              ))}
              <Text style={[styles.time, mine && styles.timeMine]}>
                {timeLabel(m)}
              </Text>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: tokens.space.md, gap: tokens.space.sm },
  row: { width: "100%" },
  rowMine: { alignItems: "flex-end" },
  rowТheirs: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "82%",
    padding: tokens.space.md,
    borderRadius: tokens.radius.md,
    gap: 4,
  },
  mine: { backgroundColor: tokens.colors.primary },
  theirs: { backgroundColor: tokens.colors.divider },
  sender: { fontSize: 11, fontWeight: "700", color: tokens.colors.muted },
  senderMine: { color: "rgba(255,255,255,0.7)" },
  text: { fontSize: 15, color: tokens.colors.primary },
  textMine: { color: tokens.colors.primaryText },
  time: { fontSize: 10, color: tokens.colors.muted, alignSelf: "flex-end" },
  timeMine: { color: "rgba(255,255,255,0.6)" },
  attach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.06)",
    padding: 6,
    borderRadius: tokens.radius.sm,
  },
  attachIcon: { fontSize: 14 },
  attachName: { fontSize: 12, flex: 1 },
});
```

> Note: rename the `rowТheirs`/`rowMine` style keys to plain ASCII (`rowTheirs`) when implementing — the example above must use ASCII identifiers. Use `rowMine` and `rowTheirs`.

- [ ] **Step 2: Fix the style identifiers to ASCII**

Ensure the keys are exactly `rowMine` and `rowTheirs` (ASCII only) in both the `styles` object and the JSX. Verify with:
Run: `grep -n "rowTheirs" src/components/ui/chat/ChatThread.tsx`
Expected: matches in both the style usage and definition; no non-ASCII characters.

- [ ] **Step 3: Implement `ChatComposer.tsx`**

```tsx
import { BottomSheet, Button, Host } from "@expo/ui";
import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { tokens } from "@/theme/tokens";

export default function ChatComposer({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      <TouchableOpacity
        style={styles.plus}
        onPress={() => setSheetOpen(true)}
        accessibilitylabel="Ajouter une pièce jointe"
      >
        <Text style={styles.plusText}>＋</Text>
      </TouchableOpacity>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Votre message"
        placeholderTextColor={tokens.colors.muted}
        multiline
      />
      <TouchableOpacity style={styles.send} onPress={send}>
        <Text style={styles.sendText}>Envoyer</Text>
      </TouchableOpacity>

      <Host style={styles.sheetHost}>
        <BottomSheet isOpened={sheetOpen} onIsOpenedChange={setSheetOpen}>
          <Button label="Photo" onPress={() => setSheetOpen(false)} />
          <Button label="PDF" onPress={() => setSheetOpen(false)} />
        </BottomSheet>
      </Host>
    </View>
  );
}

import { Text } from "react-native";

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: tokens.space.sm,
    paddingHorizontal: tokens.space.md,
    paddingTop: tokens.space.sm,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.divider,
    backgroundColor: tokens.colors.surface,
  },
  plus: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.divider,
  },
  plusText: { fontSize: 22, color: tokens.colors.primary, lineHeight: 24 },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingHorizontal: tokens.space.md,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    fontSize: 15,
  },
  send: { height: 40, paddingHorizontal: 12, justifyContent: "center" },
  sendText: { color: tokens.colors.primary, fontWeight: "700" },
  sheetHost: { position: "absolute", width: 0, height: 0 },
});
```

> Move the `import { Text } from "react-native";` to the top with the other imports when implementing (it is shown inline here only to highlight the dependency). Confirm `BottomSheet`'s `isOpened`/`onIsOpenedChange` prop names against the installed `node_modules/@expo/ui/build/universal/BottomSheet/types.d.ts`; if they differ, use the names from the `.d.ts`.

- [ ] **Step 4: Verify the BottomSheet API names**

Run: `cat node_modules/@expo/ui/build/universal/BottomSheet/types.d.ts`
Expected: confirm the open-state prop names; adjust `ChatComposer.tsx` to match exactly.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
npx tsc --noEmit && npx expo lint
git add src/components/ui/chat
git commit -m "feat(ui): chat thread and composer"
```

---

## Task 8: ThirdPartyAuthButtons (RN)

**Files:**

- Create: `src/components/ui/ThirdPartyAuthButtons.tsx`

**Interfaces:**

- Consumes: `tokens`.
- Produces: `ThirdPartyAuthButtons({ onPress }: { onPress: (provider: "google" | "apple" | "facebook") => void })` — a divider, the text "Ou continuez avec", then three buttons.

- [ ] **Step 1: Implement `ThirdPartyAuthButtons.tsx`**

```tsx
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { tokens } from "@/theme/tokens";

type Provider = "google" | "apple" | "facebook";
const LABELS: Record<Provider, string> = {
  google: "Google",
  apple: "Apple",
  facebook: "Facebook",
};

export default function ThirdPartyAuthButtons({
  onPress,
}: {
  onPress: (provider: Provider) => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow}>
        <View style={styles.line} />
        <Text style={styles.or}>Ou continuez avec</Text>
        <View style={styles.line} />
      </View>
      {(["google", "apple", "facebook"] as Provider[]).map((p) => (
        <TouchableOpacity
          key={p}
          style={styles.btn}
          onPress={() => onPress(p)}
          activeOpacity={0.7}
        >
          <Text style={styles.btnText}>{LABELS[p]}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.space.md },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.md,
  },
  line: { flex: 1, height: 1, backgroundColor: tokens.colors.border },
  or: { fontSize: 13, color: tokens.colors.muted },
  btn: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { fontSize: 16, fontWeight: "600", color: tokens.colors.primary },
});
```

- [ ] **Step 2: Typecheck + lint + commit**

```bash
npx tsc --noEmit && npx expo lint
git add src/components/ui/ThirdPartyAuthButtons.tsx
git commit -m "feat(ui): third-party auth buttons"
```

---

## Task 9: @expo/ui screens — AccountInfoList + DossierInfoList

**Files:**

- Create: `src/components/native/AccountInfoList.tsx`
- Create: `src/components/native/DossierInfoList.tsx`

**Interfaces:**

- Consumes: `@expo/ui` `Host`, `List`, `ListItem`; `AppUser`, `Dossier` types; `WithId`.
- Produces:
  - `AccountInfoList({ user }: { user: AppUser })` — label/value rows (Nom, Prénom, Email, Téléphone, Département, Ville; for backoffice also Région).
  - `DossierInfoList({ dossier }: { dossier: Dossier })` — compact label/value rows of vehicle/keys/condition/papers/pricing fields.

- [ ] **Step 1: Implement `AccountInfoList.tsx`**

```tsx
import { Host, List, ListItem } from "@expo/ui";
import type { AppUser } from "@/lib/firestore/schema";

export default function AccountInfoList({ user }: { user: AppUser }) {
  const rows: [string, string][] = [
    ["Nom", user.nom],
    ["Prénom", user.prenom],
    ["Email", user.email],
    ["Téléphone", user.telephone],
    ["Département", user.departement],
    ["Ville", user.ville],
  ];
  if (user.role === "backoffice" && user.region) {
    rows.push(["Région", user.region === "NORTH" ? "Nord" : "Sud"]);
  }
  return (
    <Host matchContents>
      <List>
        {rows.map(([label, value]) => (
          <ListItem key={label} supportingText={value}>
            {label}
          </ListItem>
        ))}
      </List>
    </Host>
  );
}
```

- [ ] **Step 2: Implement `DossierInfoList.tsx`**

```tsx
import { Host, List, ListItem } from "@expo/ui";
import type { Dossier } from "@/lib/firestore/schema";

const dash = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

export default function DossierInfoList({ dossier }: { dossier: Dossier }) {
  const { vehicle, condition, papers, pricing } = dossier;
  const rows: [string, string][] = [
    ["Marque", dash(vehicle.marque)],
    ["Modèle", dash(vehicle.modele)],
    ["Cylindrée", vehicle.cylindree ? `${vehicle.cylindree} cc` : "—"],
    ["Année", dash(vehicle.annee)],
    ["Kilométrage", vehicle.kilometrage ? `${vehicle.kilometrage} km` : "—"],
    ["Électrique", dash(vehicle.electrique)],
    ["Accessoires", dash(vehicle.accessoires)],
    ["État", dash(condition.etat)],
    ["Carte grise", dash(papers.carteGrise)],
    ["Contrôle technique", dash(papers.controleTechnique)],
    ["Prix souhaité", pricing.prix ? `${pricing.prix} €` : "—"],
    ["Commentaires", dash(pricing.commentaires)],
  ];
  return (
    <Host matchContents>
      <List>
        {rows.map(([label, value]) => (
          <ListItem key={label} supportingText={value}>
            {label}
          </ListItem>
        ))}
      </List>
    </Host>
  );
}
```

- [ ] **Step 3: Typecheck + lint + commit**

```bash
npx tsc --noEmit && npx expo lint
git add src/components/native/AccountInfoList.tsx src/components/native/DossierInfoList.tsx
git commit -m "feat(native): account and dossier info lists"
```

---

## Task 10: @expo/ui forms — SettingsList, DossierManagementForm, SignInFields, AddColleagueForm

**Files:**

- Create: `src/lib/navigation/regionOptions.ts`
- Create: `src/components/native/SettingsList.tsx`
- Create: `src/components/native/DossierManagementForm.tsx`
- Create: `src/components/native/SignInFields.tsx`
- Create: `src/components/native/AddColleagueForm.tsx`

**Interfaces:**

- Consumes: `@expo/ui` `Host`, `FieldGroup`, `Picker`, `TextInput`, `Button`, `List`, `ListItem`, `useNativeState`; `Region`, `DossierStatus`; `useRegionFilter`.
- Produces:
  - `REGION_OPTIONS: { label: string; value: "NORTH" | "SOUTH" | "ALL" }[]` and `toRegion(v): Region | null` / `fromRegion(r): "NORTH"|"SOUTH"|"ALL"`.
  - `SettingsList({ role, onInvite, onDelete })` — BO variant prepends the "Région géré" `Picker`.
  - `DossierManagementForm({ initialStatus, initialPrice, onSubmit })` — status `Picker` + price `TextInput` + "Mettre à jour" `Button`.
  - `SignInFields({ onSubmit })` — email + password `TextInput` + "Mot de passe oublié" + "Login" `Button`.
  - `AddColleagueForm({ onSubmit })` — email `TextInput` + "Envoyer l'invitation" `Button`.

- [ ] **Step 1: Implement `src/lib/navigation/regionOptions.ts`**

```ts
import type { Region } from "@/lib/firestore/schema";

export type RegionChoice = "NORTH" | "SOUTH" | "ALL";

export const REGION_OPTIONS: { label: string; value: RegionChoice }[] = [
  { label: "Moitié Nord", value: "NORTH" },
  { label: "Moitié sud", value: "SOUTH" },
  { label: "Toute la France", value: "ALL" },
];

export const toRegion = (v: RegionChoice): Region | null =>
  v === "ALL" ? null : v;
export const fromRegion = (r: Region | null): RegionChoice => r ?? "ALL";
```

- [ ] **Step 2: Implement `SettingsList.tsx`**

```tsx
import { Button, FieldGroup, Host, Picker } from "@expo/ui";
import type { UserRole } from "@/lib/firestore/schema";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import {
  REGION_OPTIONS,
  fromRegion,
  toRegion,
} from "@/lib/navigation/regionOptions";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onDelete: () => void;
}

export default function SettingsList({ role, onInvite, onDelete }: Props) {
  const { region, setRegion } = useRegionFilter();
  return (
    <Host matchContents>
      <FieldGroup>
        {role === "backoffice" ? (
          <FieldGroup.Section title="Région géré">
            <Picker
              selectedValue={fromRegion(region)}
              onValueChange={(v) => setRegion(toRegion(v as never))}
            >
              {REGION_OPTIONS.map((o) => (
                <Picker.Item key={o.value} label={o.label} value={o.value} />
              ))}
            </Picker>
          </FieldGroup.Section>
        ) : null}
        <FieldGroup.Section>
          <Button
            variant="outlined"
            label="Inviter un collègue"
            onPress={onInvite}
          />
          <Button
            variant="text"
            label="Supprimer son compte"
            onPress={onDelete}
          />
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
```

- [ ] **Step 3: Implement `DossierManagementForm.tsx`**

```tsx
import {
  Button,
  FieldGroup,
  Host,
  Picker,
  TextInput,
  useNativeState,
} from "@expo/ui";
import { useState } from "react";
import type { DossierStatus } from "@/lib/firestore/schema";

const STATUS_OPTIONS: { label: string; value: DossierStatus }[] = [
  { label: "À traiter", value: "a_traiter" },
  { label: "En cours", value: "en_cours" },
  { label: "Clôturé", value: "cloture" },
];

interface Props {
  initialStatus: DossierStatus;
  initialPrice: number | null;
  onSubmit: (status: DossierStatus, price: number | null) => void;
}

export default function DossierManagementForm({
  initialStatus,
  initialPrice,
  onSubmit,
}: Props) {
  const [status, setStatus] = useState<DossierStatus>(initialStatus);
  const price = useNativeState(
    initialPrice != null ? String(initialPrice) : "",
  );

  return (
    <Host matchContents>
      <FieldGroup>
        <FieldGroup.Section title="Statut du dossier">
          <Picker
            selectedValue={status}
            onValueChange={(v) => setStatus(v as DossierStatus)}
          >
            {STATUS_OPTIONS.map((o) => (
              <Picker.Item key={o.value} label={o.label} value={o.value} />
            ))}
          </Picker>
        </FieldGroup.Section>
        <FieldGroup.Section title="Prix d’achat validé">
          <TextInput value={price} placeholder="€" keyboardType="numeric" />
        </FieldGroup.Section>
        <Button
          label="Mettre à jour"
          onPress={() => {
            const digits = price.value.replace(/\D/g, "");
            onSubmit(status, digits ? Number(digits) : null);
          }}
        />
      </FieldGroup>
    </Host>
  );
}
```

- [ ] **Step 4: Implement `SignInFields.tsx`**

```tsx
import { Button, FieldGroup, Host, TextInput, useNativeState } from "@expo/ui";
import { Text } from "react-native";

interface Props {
  onSubmit: (email: string, password: string) => void;
  onForgotPassword: () => void;
}

export default function SignInFields({ onSubmit, onForgotPassword }: Props) {
  const email = useNativeState("");
  const password = useNativeState("");
  return (
    <Host matchContents>
      <FieldGroup>
        <FieldGroup.Section title="Adresse email *">
          <TextInput
            value={email}
            placeholder="Votre email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </FieldGroup.Section>
        <FieldGroup.Section title="Mot de passe *">
          <TextInput
            value={password}
            placeholder="Mot de passe"
            secureTextEntry
          />
        </FieldGroup.Section>
        <Button
          variant="text"
          label="Mot de passe oublié"
          onPress={onForgotPassword}
        />
        <Button
          label="Login"
          onPress={() => onSubmit(email.value, password.value)}
        />
      </FieldGroup>
    </Host>
  );
}
```

> `Text` import is unused here; remove it. (Listed only to flag that no RN `Text` is needed — `@expo/ui` handles all text.)

- [ ] **Step 5: Implement `AddColleagueForm.tsx`**

```tsx
import { Button, FieldGroup, Host, TextInput, useNativeState } from "@expo/ui";

export default function AddColleagueForm({
  onSubmit,
}: {
  onSubmit: (email: string) => void;
}) {
  const email = useNativeState("");
  return (
    <Host matchContents>
      <FieldGroup>
        <FieldGroup.Section title="Adresse email de l'invité *">
          <TextInput
            value={email}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
        </FieldGroup.Section>
        <Button
          label="Envoyer l'invitation"
          onPress={() => onSubmit(email.value)}
        />
      </FieldGroup>
    </Host>
  );
}
```

- [ ] **Step 6: Remove the unused `Text` import in `SignInFields.tsx`**

Run: `grep -n "react-native" src/components/native/SignInFields.tsx`
Expected: no match (the line was removed).

- [ ] **Step 7: Typecheck + lint + commit**

```bash
npx tsc --noEmit && npx expo lint
git add src/lib/navigation/regionOptions.ts src/components/native/SettingsList.tsx src/components/native/DossierManagementForm.tsx src/components/native/SignInFields.tsx src/components/native/AddColleagueForm.tsx
git commit -m "feat(native): settings, management, signin, and invite forms"
```

---

## Task 11: Navigation helpers, auth route, landing wiring

**Files:**

- Create: `src/lib/navigation/headerOptions.ts`
- Create: `src/app/(auth)/_layout.tsx`
- Create: `src/app/(auth)/signin.tsx`
- Modify: `src/app/index.tsx:15-17` (replace the `SIGNIN_ROUTE` cast with a real typed route)

**Interfaces:**

- Consumes: `useSession` (Task 3); `SignInFields`, `ThirdPartyAuthButtons`.
- Produces: `headerOptions({ title, back })` → an object for `Stack.Screen` `options` honoring left(back)/middle(title); `back` defaults to `true`.

- [ ] **Step 1: Implement `headerOptions.ts`**

```ts
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

/** Maps the spec's navbar contract (left/middle/right) onto the native Stack header.
 *  left = back arrow (auto when `back` is true), middle = title, right = none. */
export function headerOptions({
  title,
  back = true,
}: {
  title: string;
  back?: boolean;
}): NativeStackNavigationOptions {
  return {
    headerShown: true,
    title,
    headerBackButtonDisplayMode: "minimal",
    headerLeft: back ? undefined : () => null,
  };
}
```

> If `@react-navigation/native-stack` is not directly importable, change the return type to `import("expo-router").NativeStackNavigationOptions`-equivalent by typing the function as returning the object literal and letting `Stack.Screen` infer it. Verify with `npx tsc --noEmit`.

- [ ] **Step 2: Implement `(auth)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Implement `(auth)/signin.tsx`**

```tsx
import { type Href, useRouter } from "expo-router";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SignInFields from "@/components/native/SignInFields";
import ThirdPartyAuthButtons from "@/components/ui/ThirdPartyAuthButtons";
import { useSession } from "@/lib/data/useSession";
import { tokens } from "@/theme/tokens";

const DASHBOARDS: Record<"b2b" | "backoffice", Href> = {
  b2b: "/(b2b)/(tabs)/dashboard",
  backoffice: "/(backoffice)/(tabs)/dashboard",
};

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, setRole } = useSession();

  const goToDashboard = () => router.replace(DASHBOARDS[role]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <Text style={styles.title}>Bienvenue !</Text>
        <SignInFields onSubmit={goToDashboard} onForgotPassword={() => {}} />
        <ThirdPartyAuthButtons onPress={goToDashboard} />

        {__DEV__ ? (
          <View style={styles.devRow}>
            <Text style={styles.devLabel}>DEV — rôle :</Text>
            <Text
              style={[styles.devChip, role === "b2b" && styles.devChipOn]}
              onPress={() => setRole("b2b")}
            >
              B2B
            </Text>
            <Text
              style={[
                styles.devChip,
                role === "backoffice" && styles.devChipOn,
              ]}
              onPress={() => setRole("backoffice")}
            >
              Back-office
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.space.lg,
    backgroundColor: tokens.colors.bg,
  },
  card: {
    gap: tokens.space.lg,
    padding: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  title: { ...tokens.text.title, textAlign: "center" },
  devRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  devLabel: { fontSize: 12, color: tokens.colors.muted },
  devChip: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radius.sm,
    backgroundColor: tokens.colors.divider,
    color: tokens.colors.primary,
  },
  devChipOn: { backgroundColor: tokens.colors.primary, color: "#fff" },
});
```

- [ ] **Step 4: Update `src/app/index.tsx` to use the real route**

Replace lines 15-17 (the `SIGNIN_ROUTE` comment + cast) and its usage so the landing pushes the real route. Change:

```tsx
// TODO: build the garagiste/concessionnaire sign-in screen at src/app/signin.tsx.
// Cast is required until that route exists, since typed routes only knows real files.
const SIGNIN_ROUTE = "/signin" as Href;
```

to:

```tsx
const SIGNIN_ROUTE: Href = "/(auth)/signin";
```

Leave the `onPress={() => router.push(SIGNIN_ROUTE)}` as-is. Keep the `Href` import.

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors; `/(auth)/signin` resolves as a typed route.

- [ ] **Step 6: Manual run check**

Run: `npx expo start` and open on a simulator. Verify: landing → "Un garagiste/concessionnaire" opens the sign-in card; "Login" navigates to a dashboard; the DEV role chips flip B2B/Back-office.

- [ ] **Step 7: Commit**

```bash
git add "src/lib/navigation/headerOptions.ts" "src/app/(auth)" src/app/index.tsx
git commit -m "feat(nav): header helper, sign-in screen, landing wiring"
```

---

## Task 12: B2B group — layout, tabs, dashboard, account, settings, add-colleague, confirmation

**Files:**

- Create: `src/app/(b2b)/_layout.tsx`
- Create: `src/app/(b2b)/(tabs)/_layout.tsx`
- Create: `src/app/(b2b)/(tabs)/dashboard.tsx`
- Create: `src/app/(b2b)/(tabs)/account.tsx`
- Create: `src/app/(b2b)/(tabs)/settings.tsx`
- Create: `src/app/(b2b)/add-colleague.tsx`
- Create: `src/app/(b2b)/confirmation.tsx`

**Interfaces:**

- Consumes: `useSession`, `useDossiers`, `useAccount`, `useDossierMutations`; `DossiersSection`, `DossierCard`, `AccountInfoList`, `SettingsList`, `AddColleagueForm`, `ConfirmationView`; `headerOptions`.
- Produces: the B2B navigable surface. Tab titles set via each screen's `<Stack.Screen options={headerOptions({ title, back:false })} />`.

- [ ] **Step 1: Implement `(b2b)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function B2bLayout() {
  // Pushed screens (dossier, add-colleague) get their header from this Stack.
  // The (tabs) container manages its own per-tab titles.
  return <Stack screenOptions={{ headerShown: true }} />;
}
```

- [ ] **Step 2: Implement `(b2b)/(tabs)/_layout.tsx`**

```tsx
import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function B2bTabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
        <NativeTabs.Trigger.Label>Mon compte</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Paramètres</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

> Confirm the `<NativeTabs.Trigger.Icon>`/`<NativeTabs.Trigger.Label>` JSX shape and the `sf`/`md` prop names against `node_modules/expo-router/build/native-tabs/common/elements.d.ts`. They were verified at plan time but the package is `unstable_` — re-check if `tsc` complains, and use the names from the `.d.ts`.

- [ ] **Step 3: Implement `(b2b)/(tabs)/dashboard.tsx`**

```tsx
import { Stack, useRouter } from "expo-router";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import DossierCard from "@/components/ui/DossierCard";
import DossiersSection from "@/components/ui/DossiersSection";
import { useDossiers } from "@/lib/data/useDossiers";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function B2bDashboard() {
  const router = useRouter();
  const ongoing = useDossiers(["a_traiter", "en_cours"]);
  const closed = useDossiers(["cloture"]);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={headerOptions({ title: "Dashboard", back: false })}
      />

      <TouchableOpacity
        style={styles.cta}
        activeOpacity={0.85}
        onPress={() =>
          Alert.alert(
            "Bientôt disponible",
            "Le formulaire B2B arrive prochainement.",
          )
        }
      >
        <Text style={styles.ctaText}>Vendre une moto</Text>
      </TouchableOpacity>

      <DossiersSection
        title="Dossiers en cours"
        dossiers={ongoing.data}
        loading={ongoing.loading}
        emptyMessage="Vous n'avez pas de dossier en cours pour le moment."
        renderCard={(d) => (
          <DossierCard
            key={d.id}
            thumbnailUrl={d.thumbnailUrl}
            title={`${d.vehicle.marque} ${d.vehicle.modele}`}
            subtitle={`${d.vehicle.cylindree ?? "—"} cc`}
            status={d.status}
            onPress={() => router.push(`/(b2b)/dossier/${d.id}`)}
          />
        )}
      />

      <DossiersSection
        title="Dossiers clos"
        dossiers={closed.data}
        loading={closed.loading}
        emptyMessage="Vous n'avez pas de dossier clos pour le moment."
        renderCard={(d) => (
          <DossierCard
            key={d.id}
            thumbnailUrl={d.thumbnailUrl}
            title={`${d.vehicle.marque} ${d.vehicle.modele}`}
            subtitle={`${d.vehicle.cylindree ?? "—"} cc`}
            status={d.status}
            onPress={() => router.push(`/(b2b)/dossier/${d.id}`)}
          />
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.xl },
  cta: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: tokens.colors.primaryText,
    fontSize: 16,
    fontWeight: "700",
  },
});
```

- [ ] **Step 4: Implement `(b2b)/(tabs)/account.tsx`**

```tsx
import { Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import AccountInfoList from "@/components/native/AccountInfoList";
import { useAccount } from "@/lib/data/useAccount";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function B2bAccount() {
  const { data } = useAccount();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={headerOptions({ title: "Mon Compte", back: false })}
      />
      <AccountInfoList user={data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg },
});
```

- [ ] **Step 5: Implement `(b2b)/(tabs)/settings.tsx`**

```tsx
import { Stack, useRouter } from "expo-router";
import { Alert, ScrollView, StyleSheet } from "react-native";
import SettingsList from "@/components/native/SettingsList";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function B2bSettings() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={headerOptions({ title: "Paramètres", back: false })}
      />
      <SettingsList
        role="b2b"
        onInvite={() => router.push("/(b2b)/add-colleague")}
        onDelete={() =>
          Alert.alert(
            "Supprimer son compte",
            "Action non disponible pour le moment.",
          )
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
```

- [ ] **Step 6: Implement `(b2b)/add-colleague.tsx`**

```tsx
import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import AddColleagueForm from "@/components/native/AddColleagueForm";
import { useDossierMutations } from "@/lib/data/useDossierMutations";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function B2bAddColleague() {
  const router = useRouter();
  const { invite } = useDossierMutations();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Inviter un collègue" })} />
      <AddColleagueForm
        onSubmit={async (email) => {
          await invite(email);
          router.replace("/(b2b)/confirmation");
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
```

- [ ] **Step 7: Implement `(b2b)/confirmation.tsx`**

```tsx
import { Stack } from "expo-router";
import ConfirmationView from "@/components/ui/ConfirmationView";

export default function B2bConfirmation() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmationView
        title="C'est envoyé !"
        message="L'invitation a bien été envoyée."
        delay={1500}
        redirectTo="/(b2b)/(tabs)/dashboard"
      />
    </>
  );
}
```

- [ ] **Step 8: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 9: Manual run check**

In the running app, sign in as B2B. Verify: bottom tabs show Dashboard/Mon compte/Paramètres with native icons; dashboard shows "Vendre une moto" + two sections with cards (and the loading spinner first); tapping a card opens the dossier; Paramètres → "Inviter un collègue" → submit → confirmation → back to dashboard.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(b2b)"
git commit -m "feat(b2b): tabs, dashboard, account, settings, add-colleague, confirmation"
```

---

## Task 13: B2B dossier detail — tabs, info, chat

**Files:**

- Create: `src/app/(b2b)/dossier/[id]/_layout.tsx`
- Create: `src/app/(b2b)/dossier/[id]/index.tsx`
- Create: `src/app/(b2b)/dossier/[id]/chat.tsx`

**Interfaces:**

- Consumes: `useDossier`, `useMessages`, `useSession`, `useDossierMutations`; `PhotoCarousel`, `DossierInfoList`, `ChatThread`, `ChatComposer`; `headerOptions`.
- Produces: the B2B dossier-level surface with a 2-tab native bar (Dossier · Messages). Each tab sets the parent Stack header title via `<Stack.Screen>`.

- [ ] **Step 1: Implement `(b2b)/dossier/[id]/_layout.tsx`**

```tsx
import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function B2bDossierTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="bicycle" md="two_wheeler" />
        <NativeTabs.Trigger.Label>Dossier</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf="envelope.fill" md="mail" />
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [ ] **Step 2: Implement `(b2b)/dossier/[id]/index.tsx`**

```tsx
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DossierInfoList from "@/components/native/DossierInfoList";
import PhotoCarousel from "@/components/ui/PhotoCarousel";
import { useDossier } from "@/lib/data/useDossier";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function B2bDossierDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useDossier(id);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Dossier" })} />
      {loading || !data ? (
        <ActivityIndicator
          style={styles.spinner}
          color={tokens.colors.primary}
        />
      ) : (
        <>
          <PhotoCarousel photos={data.photos} status={data.status} />
          <View style={styles.list}>
            <Text style={styles.heading}>
              {data.vehicle.marque} {data.vehicle.modele}
            </Text>
            <DossierInfoList dossier={data} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: tokens.space.xl },
  spinner: { paddingVertical: 48 },
  list: { padding: tokens.space.lg, gap: tokens.space.md },
  heading: { ...tokens.text.title },
});
```

- [ ] **Step 3: Implement `(b2b)/dossier/[id]/chat.tsx`**

```tsx
import { Stack, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import ChatComposer from "@/components/ui/chat/ChatComposer";
import ChatThread from "@/components/ui/chat/ChatThread";
import { useMessages } from "@/lib/data/useMessages";
import { useSession } from "@/lib/data/useSession";
import { useDossierMutations } from "@/lib/data/useDossierMutations";
import { headerOptions } from "@/lib/navigation/headerOptions";

export default function B2bDossierChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useMessages(id);
  const { user } = useSession();
  const { sendMessage } = useDossierMutations();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={headerOptions({ title: "Messages" })} />
      <View style={{ flex: 1 }}>
        <ChatThread messages={data} currentUserId={user.id} />
        <ChatComposer onSend={(text) => sendMessage(id, text)} />
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 5: Manual run check**

Open a B2B dossier. Verify: bottom bar shows Dossier · Messages; Dossier tab shows the swipeable carousel with status badge + the info list; Messages tab shows bubbles (own messages on the right) + composer; the `+` opens the native bottom sheet with Photo/PDF; header title switches between "Dossier" and "Messages"; back returns to the dashboard.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(b2b)/dossier"
git commit -m "feat(b2b): dossier detail and chat tabs"
```

---

## Task 14: Back-office group — layout, tabs, dashboard (region-filtered), account, settings, confirmation

**Files:**

- Create: `src/app/(backoffice)/_layout.tsx`
- Create: `src/app/(backoffice)/(tabs)/_layout.tsx`
- Create: `src/app/(backoffice)/(tabs)/dashboard.tsx`
- Create: `src/app/(backoffice)/(tabs)/account.tsx`
- Create: `src/app/(backoffice)/(tabs)/settings.tsx`
- Create: `src/app/(backoffice)/confirmation.tsx`

**Interfaces:**

- Consumes: same hooks/components as Task 12 plus `useRegionFilter`; `SettingsList` BO variant.
- Produces: BO navigable surface with 3 dashboard sections filtered by the persisted region.

- [ ] **Step 1: Implement `(backoffice)/_layout.tsx`**

```tsx
import { Stack } from "expo-router";

export default function BackofficeLayout() {
  return <Stack screenOptions={{ headerShown: true }} />;
}
```

- [ ] **Step 2: Implement `(backoffice)/(tabs)/_layout.tsx`**

```tsx
import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function BackofficeTabsLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Icon sf="square.grid.2x2.fill" md="grid_view" />
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf="person.fill" md="person" />
        <NativeTabs.Trigger.Label>Mon compte</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>Paramètres</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [ ] **Step 3: Implement `(backoffice)/(tabs)/dashboard.tsx`**

```tsx
import { Stack, useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import DossierCard from "@/components/ui/DossierCard";
import DossiersSection from "@/components/ui/DossiersSection";
import { useDossiers } from "@/lib/data/useDossiers";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function BackofficeDashboard() {
  const router = useRouter();
  const { region } = useRegionFilter();
  const aTraiter = useDossiers(["a_traiter"], region);
  const enCours = useDossiers(["en_cours"], region);
  const closed = useDossiers(["cloture"], region);

  const card = (d: { id: string } & Record<string, any>) => (
    <DossierCard
      key={d.id}
      thumbnailUrl={d.thumbnailUrl}
      title={`${d.submitter.companyName} - ${d.submitter.prenom} ${d.submitter.nom}`}
      subtitle={`${d.vehicle.marque} ${d.vehicle.modele}`}
      onPress={() => router.push(`/(backoffice)/dossier/${d.id}`)}
    />
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={headerOptions({ title: "Dashboard", back: false })}
      />
      <DossiersSection
        title="Dossiers à traiter"
        dossiers={aTraiter.data}
        loading={aTraiter.loading}
        emptyMessage="Vous n'avez pas de dossier à traiter pour le moment."
        renderCard={card}
      />
      <DossiersSection
        title="Dossiers en cours"
        dossiers={enCours.data}
        loading={enCours.loading}
        emptyMessage="Vous n'avez pas de dossier en cours pour le moment."
        renderCard={card}
      />
      <DossiersSection
        title="Dossiers clos"
        dossiers={closed.data}
        loading={closed.loading}
        emptyMessage="Vous n'avez pas de dossier clos pour le moment."
        renderCard={card}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.xl },
});
```

> Type the `card` parameter properly when implementing: `import type { WithId } from "@/lib/data/fixtures"; import type { Dossier } from "@/lib/firestore/schema";` and use `(d: WithId<Dossier>)`. The `Record<string, any>` above is shorthand to keep the example short — replace it.

- [ ] **Step 4: Implement `(backoffice)/(tabs)/account.tsx`**

Same as `(b2b)/(tabs)/account.tsx` (Task 12 Step 4) but the component function name is `BackofficeAccount`. Full code:

```tsx
import { Stack } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import AccountInfoList from "@/components/native/AccountInfoList";
import { useAccount } from "@/lib/data/useAccount";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function BackofficeAccount() {
  const { data } = useAccount();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={headerOptions({ title: "Mon Compte", back: false })}
      />
      <AccountInfoList user={data} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
```

- [ ] **Step 5: Implement `(backoffice)/(tabs)/settings.tsx`**

```tsx
import { Stack } from "expo-router";
import { Alert, ScrollView, StyleSheet } from "react-native";
import SettingsList from "@/components/native/SettingsList";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function BackofficeSettings() {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen
        options={headerOptions({ title: "Paramètres", back: false })}
      />
      <SettingsList
        role="backoffice"
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
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: tokens.space.lg } });
```

- [ ] **Step 6: Implement `(backoffice)/confirmation.tsx`**

```tsx
import { Stack } from "expo-router";
import ConfirmationView from "@/components/ui/ConfirmationView";

export default function BackofficeConfirmation() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ConfirmationView
        title="Mis à jour"
        message="Le dossier a bien été mis à jour."
        delay={1500}
        redirectTo="/(backoffice)/(tabs)/dashboard"
      />
    </>
  );
}
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 8: Manual run check**

Sign in as Back-office (DEV chip). Verify: dashboard shows three sections (À traiter / En cours / Clos), BO cards read "[company] - [prénom nom]" with no status badge; Paramètres shows the "Région géré" picker first; selecting "Moitié Nord" filters all three dashboard sections; force-quit and relaunch → the picker still reads "Moitié Nord" and the dashboard stays filtered.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(backoffice)/_layout.tsx" "src/app/(backoffice)/(tabs)" "src/app/(backoffice)/confirmation.tsx"
git commit -m "feat(backoffice): tabs, region-filtered dashboard, account, settings, confirmation"
```

---

## Task 15: Back-office dossier detail — tabs, info, chat, management

**Files:**

- Create: `src/app/(backoffice)/dossier/[id]/_layout.tsx`
- Create: `src/app/(backoffice)/dossier/[id]/index.tsx`
- Create: `src/app/(backoffice)/dossier/[id]/chat.tsx`
- Create: `src/app/(backoffice)/dossier/[id]/management.tsx`

**Interfaces:**

- Consumes: `useDossier`, `useMessages`, `useSession`, `useDossierMutations`; `PhotoCarousel`, `DossierInfoList`, `ChatThread`, `ChatComposer`, `DossierManagementForm`; `headerOptions`.
- Produces: BO dossier surface with a 3-tab native bar (Dossier · Messages · Statut dossier).

- [ ] **Step 1: Implement `(backoffice)/dossier/[id]/_layout.tsx`**

```tsx
import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function BackofficeDossierTabs() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="bicycle" md="two_wheeler" />
        <NativeTabs.Trigger.Label>Dossier</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="chat">
        <NativeTabs.Trigger.Icon sf="envelope.fill" md="mail" />
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="management">
        <NativeTabs.Trigger.Icon sf="folder.fill" md="folder_open" />
        <NativeTabs.Trigger.Label>Statut dossier</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
```

- [ ] **Step 2: Implement `(backoffice)/dossier/[id]/index.tsx`**

Identical body to Task 13 Step 2 but with `export default function BackofficeDossierDetail()` and header title "Dossier". Full code:

```tsx
import { Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import DossierInfoList from "@/components/native/DossierInfoList";
import PhotoCarousel from "@/components/ui/PhotoCarousel";
import { useDossier } from "@/lib/data/useDossier";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function BackofficeDossierDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading } = useDossier(id);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Dossier" })} />
      {loading || !data ? (
        <ActivityIndicator
          style={styles.spinner}
          color={tokens.colors.primary}
        />
      ) : (
        <>
          <PhotoCarousel photos={data.photos} status={data.status} />
          <View style={styles.list}>
            <Text style={styles.heading}>
              {data.vehicle.marque} {data.vehicle.modele}
            </Text>
            <DossierInfoList dossier={data} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: tokens.space.xl },
  spinner: { paddingVertical: 48 },
  list: { padding: tokens.space.lg, gap: tokens.space.md },
  heading: { ...tokens.text.title },
});
```

- [ ] **Step 3: Implement `(backoffice)/dossier/[id]/chat.tsx`**

Identical to Task 13 Step 3 but `export default function BackofficeDossierChat()`. Full code:

```tsx
import { Stack, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, View } from "react-native";
import ChatComposer from "@/components/ui/chat/ChatComposer";
import ChatThread from "@/components/ui/chat/ChatThread";
import { useMessages } from "@/lib/data/useMessages";
import { useSession } from "@/lib/data/useSession";
import { useDossierMutations } from "@/lib/data/useDossierMutations";
import { headerOptions } from "@/lib/navigation/headerOptions";

export default function BackofficeDossierChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = useMessages(id);
  const { user } = useSession();
  const { sendMessage } = useDossierMutations();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={headerOptions({ title: "Messages" })} />
      <View style={{ flex: 1 }}>
        <ChatThread messages={data} currentUserId={user.id} />
        <ChatComposer onSend={(text) => sendMessage(id, text)} />
      </View>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 4: Implement `(backoffice)/dossier/[id]/management.tsx`**

```tsx
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import DossierManagementForm from "@/components/native/DossierManagementForm";
import { useDossier } from "@/lib/data/useDossier";
import { useDossierMutations } from "@/lib/data/useDossierMutations";
import { headerOptions } from "@/lib/navigation/headerOptions";
import { tokens } from "@/theme/tokens";

export default function BackofficeDossierManagement() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data, loading } = useDossier(id);
  const { updateStatusAndPrice } = useDossierMutations();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={headerOptions({ title: "Statut dossier" })} />
      {loading || !data ? (
        <ActivityIndicator
          style={styles.spinner}
          color={tokens.colors.primary}
        />
      ) : (
        <DossierManagementForm
          initialStatus={data.status}
          initialPrice={data.negotiatedPrice}
          onSubmit={async (status, price) => {
            await updateStatusAndPrice(id, status, price);
            router.replace("/(backoffice)/confirmation");
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg },
  spinner: { paddingVertical: 48 },
});
```

- [ ] **Step 5: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 6: Manual run check**

As Back-office, open a dossier. Verify: 3-tab native bar (Dossier · Messages · Statut dossier); Statut dossier shows the status dropdown (default = the dossier's status) + "Prix d'achat validé" numeric field + "Mettre à jour"; submitting routes to the confirmation screen, which auto-redirects to the dashboard.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(backoffice)/dossier"
git commit -m "feat(backoffice): dossier detail, chat, and management tabs"
```

---

## Task 16: Spec sync + full verification

**Files:**

- Modify: `docs/specs/component-navbar.md`
- Modify: `docs/specs/component-tab-bar.md`

**Interfaces:** none (documentation + final gate).

- [ ] **Step 1: Update `docs/specs/component-navbar.md`**

Replace the file's body so it describes the native implementation. New content:

```markdown
# Navbar (top header)

Implemented with the native `expo-router` Stack header (not a standalone component).
A helper `src/lib/navigation/headerOptions.ts` maps the left/middle/right contract:

- **left** — back arrow, shown automatically for pushed screens; pass `back: false`
  for root tab screens (Dashboard / Mon compte / Paramètres) which have no back arrow.
- **middle** — `title`.
- **right** — none in current specs (use `headerRight` if an action is later needed).

Each screen sets its header via `<Stack.Screen options={headerOptions({ title, back })} />`.
```

- [ ] **Step 2: Update `docs/specs/component-tab-bar.md`**

Replace the file's body:

```markdown
# Tab bar (bottom)

Implemented with `expo-router` NativeTabs (`expo-router/unstable-native-tabs`) — a real
native bottom tab bar (UITabBar on iOS, BottomNavigation on Android). Defined per context
in a `(tabs)/_layout.tsx` or `dossier/[id]/_layout.tsx`.

Each tab is a `<NativeTabs.Trigger name="<route>">` with:

- `<NativeTabs.Trigger.Icon sf="<SF Symbol>" md="<Material icon>" />` (cross-platform)
- `<NativeTabs.Trigger.Label>` (title)

Contexts:

- App level (B2B & BO): Dashboard · Mon compte · Paramètres.
- Dossier level (B2B): Dossier · Messages.
- Dossier level (BO): Dossier · Messages · Statut dossier.
```

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all suites pass (tokens, filter, useRegionFilter, useDossiers).

- [ ] **Step 4: Full typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 5: Full manual smoke (both roles)**

Run `npx expo start`, then verify on a simulator, end to end:

1. Landing → garagiste → sign-in card renders ("Bienvenue !", email/password, "Mot de passe oublié", "Login", divider, 3 third-party buttons).
2. B2B: dashboard (2 sections) → dossier (carousel + info) → chat (bubbles + composer + attach sheet); account; settings → invite → confirmation.
3. Back-office (DEV chip): dashboard (3 sections, company-prefixed cards) → dossier (3 tabs incl. Statut dossier) → management update → confirmation; settings region picker filters the dashboard and **persists across an app restart**.

- [ ] **Step 6: Commit**

```bash
git add docs/specs/component-navbar.md docs/specs/component-tab-bar.md
git commit -m "docs: sync navbar/tab-bar specs to native implementation"
```

---

## Self-review notes (already applied)

- **Spec coverage:** every page in `docs/specs/page-*.md` maps to a task (login→T11, dashboard B2B→T12, dashboard BO→T14, dossier→T13/T15, dossier-management→T15, chat→T13/T15, my-account→T12/T14, settings→T12/T14, add-colleague→T12, confirmation→T12/T14). Region filter feature → T3 (persistence) + T10 (picker) + T14 (dashboard application). Components (navbar/tab-bar/card/section) → T5/T11/T16.
- **Out-of-scope** items (auth, form funnels, real uploads/sends, thumbnails) are stubbed, matching the design doc.
- **Type consistency:** `WithId<T>`, `useDossiers(statuses, region?)`, `useRegionFilter(): { region, setRegion, ready }`, `RegionChoice`/`toRegion`/`fromRegion`, `headerOptions({ title, back })` are used identically across tasks.
- **Known re-check points flagged inline:** `@expo/ui` `BottomSheet` open-state prop names (T7 S4), NativeTabs `Icon`/`Label` JSX + `sf`/`md` props (T12 S2), `headerOptions` return type import (T11 S1). Each has an explicit verification step against the installed `.d.ts`.
