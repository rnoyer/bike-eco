---
name: project-routing
description: Expo Router v56 conventions in bike-eco — typed routes, per-screen header config, separate example app
metadata:
  type: project
---

bike-eco uses Expo Router v56 (SDK 56) with **typed routes enabled** (a union of real `app/` files is generated; navigating to a nonexistent route is a compile error).

**Why:** typed routes catch route typos at compile time.
**How to apply:**
- Per-screen options (e.g. hiding the header) are set by rendering `<Stack.Screen options={{...}} />` *inside* the screen component, not only in `_layout.tsx`. The root layout is just `<Stack />` with default `headerShown`. See `src/app/formParticuliers.tsx` and `src/app/index.tsx`.
- To stub a not-yet-created route, cast: `const X = "/route" as Href;` with a `// TODO`. Don't disable typed routes globally.
- A separate bundled `example/` app has its own broken `@/` aliases — its `tsc` errors are pre-existing noise; ignore them and grep typecheck output for `^src/`.
- Run typecheck with `npx tsc --noEmit`.
