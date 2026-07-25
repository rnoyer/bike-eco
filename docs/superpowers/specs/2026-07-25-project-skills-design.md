# Project skills for the next feature wave — design

**Date:** 2026-07-25
**Status:** approved, ready for planning

## Problem

The repo has exactly one project skill, `bike-eco-forms`, and parts of it are stale: it
describes the B2B submission, company-registration and invited-registration funnels as
"pending" and their submit handlers as "stubbed this milestone", when all three shipped
and are wired to callables. Meanwhile the layers that the next feature wave touches
hardest — auth, the display layer, the Firestore data layer, Cloud Functions — have no
skill at all. Every session rediscovers their conventions from scratch, and the
non-obvious ones (why a list query must carry its own `companyId` constraint, why
`refreshSession()` exists, why `components/native/` must not use a native `List`) are
exactly the ones that produce bugs when missed.

## Roadmap being served

Thirteen items, clustered by the layer they land in:

| Cluster | Items |
|---|---|
| Auth / account | change password funnel; forgot password + emailed reset link; Apple Sign-In; Facebook Sign-In; modal instead of inline red text for failed third-party auth; Bike-eco team registration (add/delete members, self-service recovery) |
| UI / display | infoLists visibility revamp; clickable phone/email in back-office infoLists; `commentaires` paragraph handling + char limit; the auth-failure modal |
| Forms | confirm-password field in the registration funnel; change-password funnel; forgot/reset single-step forms |
| Data | back-office: select a company or B2B user to highlight their dossiers on the dashboard |
| Functions / ops | reset + team-member emails; App Check on all callables; flip `DEV_EMAIL_OVERRIDE`; store release |
| Greenfield | push notifications; share a dossier by email / PDF / WhatsApp |

## Decisions

1. **Partition skills by `src/` layer, not by roadmap feature.** Layer boundaries already
   exist in the code and outlive any single feature. Feature-shaped skills (`password-flows`,
   `social-auth`) would duplicate shared context and become dead weight the moment their
   feature ships — and `docs/superpowers/specs` + `plans` already record per-feature intent.
2. **No skills for the greenfield items yet.** Push notifications and dossier sharing have
   no conventions to encode; a skill written now would be speculation presented as
   convention. The `expo:` plugin skills cover the libraries. Write ours after the first
   implementation lands.
3. **One source per convention.** The shared verification gate moves out of the forms skill
   into `docs/tech/verification.md`; `AGENTS.md` drops its detailed forms block for a
   pointer. Nothing is stated in two places.

## The skill set

Five skills in `.claude/skills/` — one updated, four new.

### `bike-eco-forms` (update)

Serves: confirm-password field, change-password funnel, forgot/reset forms.

Corrections to the current text:

- The three funnels (`b2b-submission`, `b2b-registration`, `b2b-invited-registration`)
  exist and are wired; drop "pending" and "stubbed this milestone".
- The reuse-or-extract list must stop hedging — `@/constants/vehicle`,
  `@/lib/forms/transforms`, `@/features/registration/fields` and
  `@/components/form/FormConfirmation` all exist now.

Additions:

- **Password-confirmation pattern** — Zod v4 cross-field equality via `.refine(...)` with
  the error attached to the confirmation field, plus its French copy. Used by both the
  registration confirm-password field and the reset-password form.
- **Single-step form + confirmation screen shape** — the forgot-password and reset-password
  screens are single-step (`useForm` directly, per `AddColleagueForm`), terminating in a
  confirmation view rather than a funnel step.
- Cross-links: auth-specific submit handlers → `bike-eco-auth`; the verification gate →
  `docs/tech/verification.md`.

### `bike-eco-auth` (new)

Serves six roadmap items — the highest-leverage new skill.

- `AuthProvider`: the `generationRef` staleness guard (a slow session load must never
  clobber a fresher one), and why `refreshSession()` exists — `onAuthStateChanged` does not
  re-fire when custom claims change, so flows that set claims server-side *after* sign-in
  must call it. Load-bearing for team registration.
- `routeGuard.ts`: `resolveAuthRoute` / `redirectFor` are pure and tested. **`PUBLIC_SEGMENTS`
  must gain the forgot-password and reset-token routes**, or the guard bounces an
  unauthenticated user back to sign-in. This is the likeliest single bug in the password work.
- `session.ts`: `parseClaims` / `buildSessionUser`; `role`, `companyId` and `status` are
  server-set claims, never client-writable.
- `authErrors.ts`: the French `mapAuthError` map is the only place auth copy lives. New
  flows need new codes — notably `auth/requires-recent-login` for change-password, and the
  password-reset codes.
- **Platform split convention**: `googleSignIn.ts` / `googleSignIn.web.ts` (also
  `region-store.ts` / `.web.ts`). Native-only SDKs get a `.web.ts` sibling.
- **Provider sign-in recipe**, the template Apple and Facebook clone: `signOut()` the
  provider SDK first so the account chooser always appears; compare the email *before*
  `signInWithCredential` so a mismatched account is never created; return `isNewUser` so a
  caller that rejects the identity can delete the Auth record instead of stranding it.
- Deep-linked token routes: `(auth)/invite-code.tsx` is the precedent for the emailed
  reset-password link.

### `bike-eco-ui` (new)

Serves: infoLists revamp, clickable phone/email, commentaires overflow, auth-failure modal.

- `theme/tokens.ts` is the single source for colour, spacing, radius, and the per-status
  badge palette. Never hardcode a hex or spacing value a token covers.
- **The two rendering layers**: `@expo/ui` (`Host` / `Column` / `Row` / `Text`) in
  `src/components/native/`, versus RN + tokens in `src/components/ui/` — and when each
  applies.
- **InfoList conventions** — the family the revamp edits: label/value rows, `dash()` for
  empty values, unit suffixes (`cc`, `km`, `€`). Documented gotcha: a non-scrolling
  `Column`, never a native `List`, because the screen's RN `ScrollView` owns scrolling and
  a native scroller measured with unbounded height crashes on Android.
- `Section` / `SectionWrapper`, `StatusBadge`, the card components.
- Modal conventions, with `ImageViewerModal` as precedent — the pattern the third-party
  auth-failure modal follows.

### `bike-eco-data` (new)

Serves: highlighting a selected company's or user's dossiers.

- App data lives in the **named `bike-eco-db`** database, not `(default)`.
- `firestore/schema.ts` + `collections.ts`: converter-backed typed refs, the `WithId<T>`
  pattern; keep both in sync when the model changes.
- **The `use*` hook contract**: `onSnapshot` + a `key` string capturing query identity,
  resolution compared against that key so a stale snapshot never renders, returning
  `{ data, loading, error }` with `error` already mapped to French by `mapDataError`.
- **Security rules shape the query.** `useDossiers`'s `companyId` where-clause is required,
  not an optimization: the read rule is `resource.data.companyId == myCompany()`, and
  Firestore rejects any list query it cannot statically prove satisfies it. The dashboard
  highlight feature is precisely where a client-side filter would be reached for and would
  fail with a permission error.
- `firestore.rules` + `indexes.json`, and the rules tests under `jest.rules.config.js`.

### `bike-eco-functions` (new)

Serves: reset + team emails, App Check, `DEV_EMAIL_OVERRIDE`, release hardening.

- **Module layout**: `core.ts` (pure logic, unit-tested) + `schemas.ts` (Zod validation of
  the request payload) + `index.ts` (thin callable wiring). New callables follow it.
- `callable.ts` helpers: `db()` for the named database, `callerFrom()` for claims,
  `toHttps()` for error mapping, and the `RegError` type.
- **The error contract crosses the wire**: server `toHttps()` pairs with client
  `frenchError()` in `src/lib/data/callable.ts`, and a server-authored French `HttpsError`
  message wins over the client's generic map. Changing one side means changing both.
- Emulator env auto-pointing in dev (`NODE_ENV !== "production"`), and the emulator run
  command.
- Email sending and the `DEV_EMAIL_OVERRIDE` switch; the message abuse-limit precedent;
  the open App Check work.

## Cross-cutting changes

**`docs/tech/verification.md` (new)** — extracted from the forms skill so all five point at
one copy:

- the gate: `npx tsc --noEmit && npx expo lint && npm test`
- the typed-routes trick: adding a route file means `tsc` cannot resolve its href until
  `.expo/types/router.d.ts` is regenerated, and bare `tsc` does not regenerate it — the dev
  server does
- what is unit-tested by project convention (pure logic: Zod schemas, pure auth/data
  helpers, function cores, rules) and what is not (step/route/field UI, gated by tsc + lint)

**`AGENTS.md`** — keeps the project map (docs index, specs index, Firestore facts, the Expo
and Zod pointers). Its detailed "Forms conventions" block is replaced by a pointer to
`bike-eco-forms`, and a short index of the five skills is added so they are discoverable
from always-loaded context.

**`~/.claude.json` cleanup** — ten phantom `bike-eco-forms-skill-<hash>` entries under
`skillUsage`, left over from skill-creator eval runs, have no files on disk but share a
single description that competes with the real skill for triggering. Back the file up to a
timestamped copy, delete only those ten keys, change nothing else.

## Non-goals

- No skills for push notifications or dossier sharing (decision 3 above).
- No implementation of any roadmap feature. This work produces skills and docs only.
- No changes to `src/` or `functions/` source.
- No restructuring of `docs/specs/` or `docs/superpowers/`.

## Verification

Skills are prose, so the gate is routing and accuracy, not tests:

1. **Accuracy** — every file path, symbol name and command quoted in a skill is checked
   against the tree at write time. A skill that names something that does not exist is a bug.
2. **Routing** — a table mapping each of the 13 roadmap items to the skill(s) that should
   fire, checked against the written descriptions for gaps (an item no skill claims) and
   collisions (an item several claim equally). The existing
   `.claude/skills/bike-eco-forms-workspace/trigger-evals.json` is the format precedent.
3. **No regression in the repo gate** — `docs/` and `.claude/` changes must leave
   `npx tsc --noEmit && npx expo lint && npm test` green.
