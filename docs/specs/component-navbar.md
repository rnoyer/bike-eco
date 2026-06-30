# Navbar (top header)

Implemented with the native `expo-router` Stack header (not a standalone component).
A helper `src/lib/navigation/headerOptions.ts` maps the left/middle/right contract:

- **left** — back arrow, shown automatically for pushed screens; pass `back: false`
  for root tab screens (Dashboard / Mon compte / Paramètres) which have no back arrow.
- **middle** — `title`.
- **right** — none in current specs (use `headerRight` if an action is later needed).

Each screen sets its header via `<Stack.Screen options={headerOptions({ title, back })} />`.
