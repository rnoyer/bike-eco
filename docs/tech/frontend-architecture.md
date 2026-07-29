# Frontend architecture — pages & components

How the logged-in app surface (B2B dealer + Bike-eco back office, plus the shared
sign-in) is built. The multi-step form funnels are now implemented (UI + Zod
validation) with **stubbed submit handlers**; the data layer is mocked. Both swap in
their real backend later without touching the screens.

See also: `docs/product/bike-eco-app.md` (product), `docs/specs/*` (per-page/component
contracts), `docs/tech/firestore-data-model.md` (data model).

## Stack

- **Expo SDK 56**, expo-router (file-based routing) with **typed routes** and the
  **React Compiler** both enabled (`app.json` → `experiments.typedRoutes` / `reactCompiler`).
- **Native-first, cross-platform (iOS + Android):**
  - Bottom tabs: `expo-router/unstable-native-tabs` (`NativeTabs`) → real UITabBar /
    BottomNavigation.
  - Top header: the native expo-router Stack header, configured via `headerOptions`.
  - Read-only list-shaped screens (account info, dossier info): **`@expo/ui`** universal
    components (`Host`, `Column`/`Row`, `Text`, …) which render real SwiftUI / Jetpack
    Compose. These native islands use a **non-scrolling** layout (`<Host matchContents>` +
    `Column`), never the scrollable `List`/`FieldGroup`: those compile to a Compose
    `LazyColumn`, which crashes on Android when measured with unbounded height
    (`matchContents`, or nested inside the screen's RN `ScrollView`). The enclosing RN
    `ScrollView` owns scrolling for the whole screen.
  - **All inputs go through the shared RN `form/` layer** — every text field, dropdown,
    and checkbox (in the b2c funnel *and* the b2b/back-office forms: sign-in, add-colleague,
    settings, dossier management) uses `ControlledField`/`ControlledDropdown`/… over
    react-hook-form + Zod, with the shared `ui/Button`. We do **not** use `@expo/ui`
    `TextInput`/`Picker`/`Button` for editable inputs, so validation and styling live in
    one place. (You can't nest an RN input inside an `@expo/ui` `Host` tree, so any screen
    with an input is a plain-RN screen.)
  - Where no native universal primitive fits (chat bubbles, photo carousel, dossier card,
    landing/sign-in card), plain React Native + `StyleSheet`.
- **Persistence:** `expo-sqlite/kv-store` (AsyncStorage-compatible) for the region filter.
- **Icons:** cross-platform via NativeTabs `sf=` (SF Symbols, iOS) + `md=` (Material, Android);
  no extra icon dependency.

## Directory map

```
src/
  app/                              # expo-router route tree (file = route)
    index.tsx                       # landing ("Qui êtes-vous ?") → pushes /(auth)/signin
    (auth)/_layout.tsx              # headerless Stack
    (auth)/signin.tsx              # "Bienvenue !" card; DEV role chips flip B2B/BO
    (b2b)/                          # B2B dealer group
      _layout.tsx                   # Stack (header shown)
      (tabs)/_layout.tsx            # NativeTabs: Dashboard · Mon compte · Paramètres
      (tabs)/{dashboard,account,settings}.tsx   # thin wrappers (see below)
      add-colleague.tsx             # AddColleagueForm → confirmation
      confirmation.tsx              # ConfirmationView → dashboard
      dossier/[id]/_layout.tsx      # NativeTabs: Dossier · Messages
      dossier/[id]/{index,chat}.tsx # thin wrappers
    (backoffice)/                   # Bike-eco back office group (mirrors b2b)
      …(tabs), confirmation
      dossier/[id]/_layout.tsx      # NativeTabs: Dossier · Messages · Statut dossier
      dossier/[id]/{index,chat,management}.tsx   # management is BO-only
  components/
    screens/                        # shared role-parameterized SCREEN BODIES
      DashboardScreen.tsx           # role + onOpenDossier + onSell?
      SettingsScreen.tsx            # role + onInvite + onDelete
      AccountScreen.tsx             # role-agnostic
      DossierDetailScreen.tsx       # id
      DossierChatScreen.tsx         # id
    native/                         # @expo/ui read-only list screens (native styling)
      AccountInfoList, DossierInfoList
    form/                           # shared RN inputs + composite forms (react-hook-form + Zod)
      FormLayout, FormField, Dropdown, CheckboxGroup,
      Controlled{Field,Dropdown,CheckboxGroup}, PhotoPicker,
      SignInFields, AddColleagueForm, DossierManagementForm, SettingsList
    ui/                             # RN + StyleSheet components
      Button, StatusBadge, DossierCard, DossiersSection,
      PhotoCarousel, ConfirmationView, ThirdPartyAuthButtons,
      chat/{ChatThread, ChatComposer}
  lib/
    data/                          # mocked data layer (swap to Firestore later)
      fixtures, filter, region-store, useRegionFilter, useSession,
      useDossiers, useDossier, useMessages, useAccount, useDossierMutations
    navigation/
      headerOptions.ts             # native Stack header from { title, back } (direct Stack children)
      groupHeaders.tsx             # focused-tab title + tab-switching back arrow for NativeTabs screens
      regionOptions.ts             # REGION_OPTIONS + toRegion/fromRegion
  theme/tokens.ts                  # design tokens for the RN components
```

## The wrapper / shared-screen split (DRY)

The B2B and back-office surfaces are near-identical. To avoid duplicating screen bodies
across the two route groups, each screen body lives once in `src/components/screens/`,
**parameterized by `role` and by navigation callbacks** (never by hardcoded hrefs). The
route files under `src/app/` are **thin wrappers** that inject the role and the
group-specific navigation:

```tsx
// src/app/(b2b)/(tabs)/dashboard.tsx
export default function B2bDashboard() {
  const router = useRouter();
  return (
    <DashboardScreen
      role="b2b"
      onOpenDossier={(id) => router.push(`/(b2b)/dossier/${id}`)}
      onSell={() => Alert.alert("Bientôt disponible", "…")}
    />
  );
}
```

Benefits:
- One place to change a screen's layout/behavior; both roles stay in sync.
- Shared screens hold **no route literals**, so they typecheck independently of the route
  tree and stay testable/portable.
- All typed-route hrefs live in the thin wrappers (and `signin.tsx` / `confirmation.tsx`),
  which is where group context actually belongs.

Role differences handled inside the shared screens:
- **DashboardScreen** — calls all hooks unconditionally (`useRegionFilter` + three
  `useDossiers`) *before* branching on role (rules-of-hooks safe). B2B: "Vendre une moto"
  CTA + two sections ("en cours" merges `a_traiter`+`en_cours`, "clos"), cards show
  `marque modèle` / `cylindrée`, no region filter. BO: three sections
  (à traiter / en cours / clos) filtered by the persisted region, cards show
  `société - prénom nom` / `marque modèle`. Neither role's `DossierCard` shows a
  status badge (badges live only on the dossier-detail photo carousel).
- **SettingsScreen** — passes `role` to `SettingsList`, which shows the "Région gérée"
  picker only for back office. Wrappers supply `onInvite` (B2B pushes add-colleague; BO is
  a stub Alert) and `onDelete` (stub Alert).
- The simplest cases (`AccountScreen`, `DossierDetailScreen`, `DossierChatScreen`) are
  fully shared; their tab wrappers are one-liners (e.g.
  `export { default } from "@/components/screens/AccountScreen"`).

## Navigation

- **Header:** the **root** Stack is `headerShown: false` so it never draws a header per
  route group (that caused stacked `(b2b)` / `(tabs)` headers). Headers are owned per
  group:
  - Direct Stack children (e.g. add-colleague) set theirs inline with
    `headerOptions({ title, back })` → `NativeStackNavigationOptions` (imported from
    `expo-router`, which re-exports it).
  - The `(tabs)` and `dossier/[id]` screens are `NativeTabs` navigators with no header of
    their own, so the group `_layout` derives both title and left arrow from the focused
    tab via the `useGroupHeaders` hook (`lib/navigation/groupHeaders.tsx`), which reads the
    route reactively with `useSegments` (a native tab switch doesn't re-run the parent
    Stack's `options` function).
    Secondary tabs get a custom `headerLeft` (`HeaderBackButton`) that **switches tabs**
    rather than popping: Mon Compte / Paramètres → Dashboard, Messages / Statut dossier →
    Dossier. Dashboard has no arrow (post-login root); the Dossier tab keeps the native
    back (it was pushed from the dashboard). The `component-navbar.md` spec has the table.
- **Tabs:** declared in each context's `_layout.tsx` with `NativeTabs.Trigger` +
  `.Trigger.Icon` (`sf`/`md`) + `.Trigger.Label`. See `component-tab-bar.md`.
- **Typed routes:** hrefs are group-qualified, e.g. `/(b2b)/(tabs)/dashboard`,
  `/(b2b)/dossier/${id}`, `/(auth)/signin`. The generated types live in
  `.expo/types/router.d.ts` (gitignored). **`tsc` does not regenerate them** — running the
  dev server (`npx expo start`) does, on boot (~2s). After adding/renaming a route, start
  the dev server once (or `expo export`) to refresh the types before typechecking.

## Data layer

**Read hooks return `{ data, loading, error }`.** `loading` is derived from a resolved-key
match against the query's identity (no synchronous `setState` in effects → React Compiler
clean), and `error` is already-French copy from `mapDataError` — a screen renders it, it
never maps a raw Firebase code itself. All three are meant to be consumed: `Section` takes
`loading` + `error` + `emptyMessage` and owns the precedence between them, and
`ScreenLoader` / `ScreenMessage` do the same job for a whole screen. **No screen returns
`null` while a read is in flight** — a blank screen is indistinguishable from a broken one.

**Write hooks return `{ …action, pending, error }`**, built on `useAsyncAction`
(`src/lib/ui/useAsyncAction.ts`), which owns the three things every user-initiated async
action needs: a synchronous re-entry guard (a ref, because `pending` only lands on the
next render), the pending flag the UI renders, and the mapped French error. `useInvite`
and `useDossierManagement` compose it, so their callers get `pending` without a second
mechanism. The action resolves to `undefined` on failure, so a caller navigates to the
success screen only on a real result — never a false "success".

Firestore buffers a write it cannot reach the server with, so a write that must not hang
forever offline goes through `writeWithTimeout` (15 s).

`useRegionFilter` additionally exposes `ready`, false until the persisted région hydrates.
Consumers whose query is région-scoped must hold their loading state until then, or their
first render answers a "Toute la France" query and visibly re-queries.

`docs/tech/loading-states-audit.md` is the full inventory of async call sites and the
remediation that produced these conventions.

`dossiers` are B2B-only in the real model; the public B2C funnel remains email-only.

## Forms

All four multi-step funnels reuse the shared engine (`src/lib/forms/useStepForm.ts`
+ `src/components/form/*`): a Zod `schema.ts`, a declarative `steps.tsx`, and a
`submit.ts`, rendered through `FormLayout`.

- `src/features/b2c-submission/` — public B2C funnel (email-only via a Cloud
  Function; the reference implementation).
- `src/features/b2b-submission/` — logged-in "Vendre une moto" → `/(b2b)/vehicule-submission`.
- `src/features/b2b-registration/` — company signup → `/(auth)/register`.
- `src/features/b2b-invited-registration/` — invited teammate (prefilled disabled
  email from `?email=`) → `/(auth)/register-invited`.

Shared bits: option lists in `src/constants/vehicle.ts`, the digit transform in
`src/lib/forms/transforms.ts`, the registration field groups in
`src/features/registration/fields.tsx`, and the terminal screen
`src/components/form/FormConfirmation.tsx`.

The B2B `submit.ts` handlers are **stubbed** (simulate latency, log under `__DEV__`)
— real Firebase Auth / Firestore writes / Storage uploads / Cloud Functions are a
later milestone. Only the Zod schemas are unit-tested; step/route UI is gated by
`tsc` + `expo lint`.

## Region filter (back office)

- Choice persisted under one kv-store key as `NORTH | SOUTH | ALL`
  (`region-store.ts` + `useRegionFilter`). `ALL` ⇒ `null` ⇒ no filtering.
- `regionOptions.ts` holds the UI options (`Moitié Nord` / `Moitié sud` / `Toute la
  France`) and the `toRegion`/`fromRegion` mapping between the stored value and `Region | null`.
- The BO settings picker writes the choice; the BO dashboard reads it and passes it to
  `useDossiers`, so all three sections filter together and the selection survives an app
  restart.

## Conventions

- Reuse `theme/tokens.ts` for the RN components; `@expo/ui` screens use native styling.
- UI copy is French and must match the page/component specs in `docs/specs/`.
- No unit tests for presentational components — they are gated by `tsc --noEmit` +
  `expo lint`. Only pure logic/hooks are unit-tested (`npm test`: tokens, filter,
  useRegionFilter, useDossiers).
- Keep a spec (`docs/specs/*`) in sync in the same change that alters its feature.

## What's stubbed / deferred

Real auth, the form funnels' **submit handlers** (schema + UI are implemented; the
handlers are stubbed), photo/PDF uploads and message sending, server-set
`role`/`companyId`/`status` claims, and thumbnail generation. The sign-in DEV role chips
are dev-only (`__DEV__`). Swapping the mocked `lib/data` hooks for Firestore reads/writes
is the next milestone and requires no screen changes.
