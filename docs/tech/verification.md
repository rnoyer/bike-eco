# Verification

The single source for how a change is gated in this repo. Every project skill points
here rather than restating it.

## The gate

Run before considering any change done:

```bash
npx tsc --noEmit && npx expo lint && npm test
```

All three must be green. `npm test` runs the `jest-expo` project defined under the `jest`
key in `package.json`.

## What is unit-tested, and what is not

The convention is **pure logic is tested; UI is gated by `tsc` + lint.** Adding render
tests for screens is not the house style.

| Tested | Not tested |
|---|---|
| Zod schemas (`src/features/*/__tests__/schema.test.ts`) | Step / route / field UI |
| Pure auth helpers (`routeGuard`, `session`, `authErrors`, `googleEmail`) | Screens and components |
| Pure data helpers (`selectCompanies`, `dataErrors`, `useRegionFilter`) | `use*` hooks that only wrap `onSnapshot` |
| Cloud Function cores (`functions/src/*/core.ts`, `schemas.ts`) | Callable wiring in `index.ts` |
| Security rules (see below) | Storage upload plumbing |

Import jest globals explicitly:

```ts
import { describe, expect, test } from "@jest/globals";
```

## Security-rules tests

Rules tests need the emulators and a separate jest config — the `jest-expo` preset's
`setupFiles` install Expo's `expo/fetch` polyfill, which breaks the rules-unit-testing
client:

```bash
npm run test:rules
```

The emulator needs a JDK newer than the system default (17). If it fails to start:

```bash
JAVA_HOME=/usr/local/jdk-26.0.1 npm run test:rules
```

Use `firebase-tools@latest` via `npx`; do not pin an older major to work around a JDK
error — raise `JAVA_HOME` instead.

## Typed-routes gotcha

Adding a route file under `src/app/` means `tsc` cannot resolve its `href` until
`.expo/types/router.d.ts` is regenerated — and **bare `tsc` does not regenerate it.** The
dev server does. After adding a route:

```bash
rm -f .expo/types/router.d.ts
( npx expo start > /tmp/expo-typegen.log 2>&1 & )
for i in $(seq 1 30); do [ -f .expo/types/router.d.ts ] && echo "TYPES REGENERATED" && break; sleep 1; done
pkill -f "expo start"; pkill -f "expo/cli"; sleep 1
```

Then re-run the gate.

## Native modules

Adding an Expo native module requires rebuilding the dev client — a Metro reload does not
include native code:

```bash
npx expo run:android
```

## Keeping docs in sync

A change that alters a feature's behavior updates its spec in `docs/specs/` in the **same
commit**. The specs are the source of truth for product behavior, layout, and French copy.
