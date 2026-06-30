# Navbar (top header)

Implemented with the native `expo-router` Stack header (not a standalone component),
mapping the left/middle/right contract:

- **left** — back arrow (see per-screen behavior below).
- **middle** — `title`.
- **right** — none in current specs (use `headerRight` if an action is later needed).

Two cases, because of how the screens nest:

- **Direct Stack children** (e.g. add-colleague) set their own header inline via
  `<Stack.Screen options={headerOptions({ title, back })} />` (`src/lib/navigation/headerOptions.ts`).
  The back arrow is the native one and pops the Stack.
- **`NativeTabs` screens** — the main `(tabs)` and each `dossier/[id]` are themselves
  tab navigators with no top header of their own, so a child's `<Stack.Screen>` can't
  reach the enclosing header. Instead the group `_layout` (`(b2b)`/`(backoffice)`)
  derives both the **title** and the **left arrow** from the focused tab, via the
  `useGroupHeaders` hook in `src/lib/navigation/groupHeaders.tsx`. The hook reads the
  focused route reactively (`useSegments`) because a native tab switch does NOT re-run
  the parent Stack's `options` function. Because the destination is a sibling tab (not a
  stack pop), the arrow is a custom `headerLeft` (`HeaderBackButton`) that switches tabs:

  | Screen | Title | Left arrow → |
  |---|---|---|
  | Dashboard | "Dashboard" | none (post-login root) |
  | Mon Compte | "Mon Compte" | Dashboard tab |
  | Paramètres | "Paramètres" | Dashboard tab |
  | Dossier | "Dossier" | native back → Dashboard (pushed screen) |
  | Messages | "Messages" | Dossier tab |
  | Statut dossier | "Statut dossier" | Dossier tab |

The **root** Stack (`app/_layout.tsx`) is `headerShown: false` so it never draws a
header per route group (otherwise each group/tabs layer stacked its own header).
