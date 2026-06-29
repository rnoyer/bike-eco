# Frontend pages scaffold — design

Date: 2026-06-29
Status: Approved design (pending spec review)

## Goal

Scaffold every **page** for the B2B (concessionnaire) and Back-office paths, plus the
shared sign-in page, using a **native-first** component strategy that works on both iOS
and Android. Form *funnels* (the multi-step B2B vehicle submission, company/invited
registration) are explicitly **out of scope** for this pass and will reuse the existing
`useStepForm` + `FormLayout` engine later. Sign-in and add-colleague *are* in scope as
static pages (stubbed submit handlers, no real auth/validation yet).

The existing B2C funnel (`src/app/b2cSubmissionForm.tsx`, `src/features/b2c-submission/`)
is the inspiration for conventions but is **not modified**.

## Principles

1. **Native-first, cross-platform.** Prefer `@expo/ui` universal components and native
   `expo-router` chrome (Stack header, Tabs) wherever they fit, since they render real
   SwiftUI on iOS and Jetpack Compose on Android from one tree. Drop to React Native +
   `StyleSheet` only where no native universal primitive exists (carousel, chat bubbles,
   custom card layouts).
2. **Pages render shared components.** The two route groups (`(b2b)`, `(backoffice)`)
   duplicate only thin route files; all UI lives in shared components driven by role/config.
3. **Mock data behind a hooks interface.** Pages read from `src/lib/data/*` hooks typed
   against `src/lib/firestore/schema.ts`. Swapping to real Firestore + auth later must not
   touch a single component.

## Decisions (from brainstorming)

- **Styling/UI**: `@expo/ui` native for list/form/settings-shaped screens; RN + StyleSheet
  fallback for genuinely custom layouts. Forms funnels keep the existing RN engine.
- **Data**: mock data layer now, real Firestore/auth later.
- **Routing**: separate `(b2b)` and `(backoffice)` route groups.
- **Chrome**: native `expo-router` Stack header + native bottom tabs (no standalone custom
  Navbar/TabBar components). `docs/specs/component-navbar.md` and
  `docs/specs/component-tab-bar.md` will be updated to describe the native approach.
- **Auth/forms scope**: sign-in and add-colleague built now as static pages.

## Routing & folder architecture

```
src/app/
  index.tsx                         # existing landing ("Qui êtes-vous ?") — untouched
  b2cSubmissionForm.tsx             # existing B2C funnel — untouched
  _layout.tsx                       # root Stack (add SafeAreaProvider if missing)

  (auth)/
    _layout.tsx                     # Stack, header hidden
    signin.tsx                      # page-login-signup

  (b2b)/
    _layout.tsx                     # Stack; stub role guard (role === "b2b")
    (tabs)/
      _layout.tsx                   # bottom tabs: Dashboard · Mon compte · Paramètres
      dashboard.tsx                 # page-dashboard (B2B variant)
      account.tsx                   # page-my-account
      settings.tsx                  # page-settings
    add-colleague.tsx               # page-add-colleague (pushed, no tab bar)
    confirmation.tsx                # page-confirmation
    dossier/[id]/
      _layout.tsx                   # bottom tabs: Dossier · Messages
      index.tsx                     # page-dossier
      chat.tsx                      # page-chat

  (backoffice)/
    _layout.tsx                     # Stack; stub role guard (role === "backoffice")
    (tabs)/
      _layout.tsx                   # bottom tabs: Dashboard · Mon compte · Paramètres
      dashboard.tsx                 # page-dashboard (Back-office variant)
      account.tsx                   # page-my-account
      settings.tsx                  # page-settings
    confirmation.tsx                # page-confirmation
    dossier/[id]/
      _layout.tsx                   # bottom tabs: Dossier · Messages · Statut dossier
      index.tsx                     # page-dossier
      chat.tsx                      # page-chat
      management.tsx                # page-dossier-management (BO only)
```

Two **tab contexts** exist in the specs — app-level (Dashboard/Mon compte/Paramètres) and
dossier-level (Dossier/Messages[/Statut]) — so each is its own nested tab layout. The
back-office dossier layout adds the third "Statut dossier" tab; B2B does not.

Native bottom tabs are the target (platform `UITabBar` / Material `BottomNavigation`). If
the fully-native tab API proves unstable for nested/dynamic tab sets during
implementation, fall back to `expo-router`'s `Tabs` (still a native-styled bar). Tab icons
come from `expo-symbols` (SF Symbols) with Android equivalents.

## Mock data layer (`src/lib/data/`)

Typed against `src/lib/firestore/schema.ts`. Hooks return `{ data, loading }` shapes so the
real Firestore version (snapshot listeners) is a drop-in swap.

- `useSession()` → `{ role: UserRole, user: AppUser }`. Stubbed, with a `__DEV__`-only role
  switcher so both groups are previewable from one build.
- `useDossiers(statuses: DossierStatus[], region?: Region | null)` → list for a dashboard
  section, ordered by `createdAt`, optionally filtered by region. One call per section
  (matches `component-dossiers-section.md`).
- `useRegionFilter()` → `{ region: Region | null, setRegion }` — the back-office
  "Territoire géré" setting (`NORTH` / `SOUTH` / `null` = Toute la France, the default).
  **Persisted locally and restored on app restart** via `expo-sqlite/kv-store` (the
  AsyncStorage-compatible, cross-platform key/value API; no extra non-Expo dependency).
  The BO dashboard passes `region` from this hook into each `useDossiers(...)` call; B2B
  ignores it.
- `useDossier(id)` → single `Dossier`.
- `useMessages(dossierId)` → `Message[]`.
- `useAccount()` → current `AppUser`.
- `fixtures.ts` → sample `Company` / `AppUser` / `Dossier` / `Message` records with real
  remote photo URLs (so thumbnails and the carousel render).
- `useDossierMutations()` → stubbed `updateStatusAndPrice`, `sendMessage`, `invite` that
  resolve after a tick (for the management, chat, and add-colleague screens).

## Component inventory

### Native chrome (no standalone component)

- **Header (navbar)**: `src/lib/navigation/headerOptions.ts` — a helper producing Stack
  `screenOptions`/`Stack.Screen` options honoring the spec's left (back) / middle (title) /
  right (action) contract via `headerLeft` / `headerTitle` / `headerRight`.
- **Bottom tabs (tab bar)**: `src/lib/navigation/tabsConfig.ts` — per-context tab
  definitions `{ name, title, icon }` consumed by each `(tabs)/_layout.tsx` and
  `dossier/[id]/_layout.tsx`.

### `@expo/ui` native screens/components

All wrapped in `Host`. Source of truth for props = the installed `@expo/ui` `.d.ts`.

| Component / screen | `@expo/ui` primitives | Used by |
|---|---|---|
| `AccountInfoList` | `List` + `ListItem` (label/value rows) | page-my-account |
| `SettingsList` | `List` + `Button` (Inviter un collègue / Supprimer son compte); BO variant adds a region `Picker` ("Territoire géré") wired to `useRegionFilter` | page-settings |
| `DossierManagementForm` | `FieldGroup` + `Picker` (status) + `TextInput` (price, €) + `Button` | page-dossier-management |
| `DossierInfoList` | `List` label/value (vehicle fields, compact) | page-dossier (below carousel) |
| `SignInFields` | `FieldGroup` + `TextInput` (email/password) + `Button` | page-login-signup |
| `AddColleagueForm` | `FieldGroup` + `TextInput` (email) + `Button` | page-add-colleague |
| Chat attach menu | `BottomSheet` (Photo / PDF options) | page-chat composer |

`@expo/ui` `TextInput` uses `useNativeState` (not a plain string) — noted for the four
input-bearing screens. `List` is fine here because all lists are small (one garage's
dossiers, a handful of account fields); no large-list usage.

### React Native + StyleSheet components (no native universal equivalent)

Reuse extracted theme tokens. Live under `src/components/ui/`.

| Component | Why RN | Used by |
|---|---|---|
| `PhotoCarousel` | no universal carousel → horizontal paged `ScrollView` + `expo-image` | page-dossier |
| `DossierCard` | thumbnail-left + title + subtitle row → `expo-image` + custom layout | dashboard sections |
| `DossiersSection` | title + cards + centered spinner + per-section empty message | page-dashboard |
| `StatusBadge` | colored status pill (a_traiter / en_cours / cloture) | dossier card + dossier detail |
| `ChatThread` (`ChatBubble`) | message bubbles, sender label, timestamp, attachment chip | page-chat |
| `ChatComposer` | text input + `+` attach (opens `@expo/ui` `BottomSheet`) | page-chat |
| `ThirdPartyAuthButtons` | Google / Apple / Facebook row + divider | page-login-signup |
| `ConfirmationView` | generalize existing `SubmissionConfirmation`: props `title`, `message?`, `delay=500`, `redirectTo` | page-confirmation |

### Shared foundation

- `src/theme/tokens.ts` — extract hardcoded b2c values into one module: `colors`
  (`primary #111`, `muted #71727A`, `border #E5E7EB`, `divider #F3F4F6`, `disabled #C1C1C6`,
  surface `#fff`), `radius` (md 12), `space` (e.g. 8/12/16/20/24/28), `text` (title 24/bold,
  subtitle 14/#71727A). Existing b2c StyleSheets may later be refactored to consume it, but
  that is not required in this pass.
- `src/lib/navigation/` — `headerOptions.ts`, `tabsConfig.ts` (above).

## Page-by-page mapping

| Page spec | Route | Composition |
|---|---|---|
| page-login-signup | `(auth)/signin` | card → `SignInFields` (@expo/ui) + `ThirdPartyAuthButtons` |
| page-dashboard (B2B) | `(b2b)/(tabs)/dashboard` | "Vendre une moto" `Button` + `DossiersSection`×2 (en cours, clos) of `DossierCard` |
| page-dashboard (BO) | `(backoffice)/(tabs)/dashboard` | `DossiersSection`×3 (à traiter, en cours, clos), filtered by `useRegionFilter` |
| page-dossier | `(group)/dossier/[id]/index` | `PhotoCarousel` + `StatusBadge` + `DossierInfoList` |
| page-dossier-management | `(backoffice)/dossier/[id]/management` | `DossierManagementForm` |
| page-chat | `(group)/dossier/[id]/chat` | `ChatThread` + `ChatComposer` (+ `BottomSheet` attach) |
| page-my-account | `(group)/(tabs)/account` | `AccountInfoList` |
| page-settings | `(group)/(tabs)/settings` | `SettingsList` |
| page-add-colleague | `(b2b)/add-colleague` | `AddColleagueForm` → `confirmation` |
| page-confirmation | `(group)/confirmation` | `ConfirmationView` |

## Error / loading / empty states

- Each dashboard `DossiersSection` owns its own loading (centered spinner under title) and
  empty message (per `component-dossiers-section.md` wording).
- Detail/account/chat screens show a centered spinner while their hook is `loading`, and a
  simple error text on failure (mock layer can simulate both via fixture flags).
- Stubbed mutations (management update, send message, invite) show a pending state on the
  action button and navigate to `confirmation` on success.

## Out of scope (this pass)

- Real Firebase Auth, session persistence, route guards beyond the stub, security rules.
- B2B/registration form funnels (handled later via `useStepForm`).
- Real file upload for chat attachments and real message send.
- Image thumbnail generation (fixtures provide ready thumbnail URLs).

## Specs to update alongside implementation

- `docs/specs/component-navbar.md` → native Stack header approach.
- `docs/specs/component-tab-bar.md` → native bottom tabs approach.
- Keep all page specs in sync if layout choices change during build.
