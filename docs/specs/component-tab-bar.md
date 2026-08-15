# Tab bar (bottom)

A bottom tab bar on every platform, always visible. One tab set per context, declared once
in `src/lib/navigation/tabs.ts` and rendered by `@/components/navigation/GroupTabs` — which
Metro resolves per platform:

| File | Platform | Built from |
|---|---|---|
| `GroupTabs.native.tsx` | iOS, Android | `NativeTabs` (`expo-router/unstable-native-tabs`) — a real native bottom tab bar (UITabBar / BottomNavigation) |
| `GroupTabs.tsx` | web | `Tabs` / `TabList` / `TabTrigger` / `TabSlot` (`expo-router/ui`) — a custom bottom bar styled from `@/theme/tokens` |

The `(tabs)/_layout.tsx` and `dossier/[id]/_layout.tsx` files just render
`<GroupTabs tabs={…} />`; they hold no tab definitions of their own.

## Why web does not use NativeTabs

`NativeTabs` has a web renderer, but it is not a bottom tab bar: it draws a
`position: fixed; top: 24px` pill, which lands behind the group `Stack`'s 64px header —
and loses to it, because every react-native-web `View` carries `z-index: 0`, so the pill's
own `z-index: 10` only ranks it inside the content subtree. It also renders the label
only, dropping the `sf` / `md` icons. Hence the separate web implementation.

## Tab definitions

Each entry in `tabs.ts` carries both renderers' needs:

- `name` — route segment (and the `TabTrigger` name on web)
- `label` — French label
- `sf` / `md` — SF Symbol and Material Symbol, native only
- `icon` — SVG asset in `assets/images/icons/`, web only, tinted via `expo-image`
- `href` — absolute route; required by `TabTrigger` inside a `TabList`

Keep `sf` / `md` / `icon` depicting the same thing, so the two platforms stay visually
consistent. The web icons are the Material Symbols matching each `md` name.

**One documented exception**, the dossier tab's motorbike: SF Symbols only gained
`motorcycle` in version 6 (iOS 18), and the deployment target is 16.4. Below iOS 18 that
tab falls back to `bicycle`, because an unavailable symbol renders as *no icon at all* —
`[UIImage systemImageNamed:]` returns nil — which is worse than the wrong vehicle. Drop
the fallback once the deployment target reaches 18.

Contexts:
- App level (B2B & BO): Dashboard · Mon compte · Paramètres — `B2B_TABS`, `BACKOFFICE_TABS`.
- Dossier level (B2B): Dossier · Messages — `b2bDossierTabs(id)`.
- Dossier level (BO): Dossier · Messages · Statut dossier — `backofficeDossierTabs(id)`.

The dossier sets are functions because the `href` carries the dossier id.
