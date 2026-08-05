# User management — design

Date: 2026-08-05
Branch: `feat/manage-users`

Adds an `isAdmin` flag to every account, a "Mes collaborateurs" area where an admin
manages their company's (or the back-office team's) users, self-deletion of a
non-admin account, and revamps the back-office "Entreprise" page around the new
colleague card.

## 1. Data model

`AppUser` gains `isAdmin: boolean` (`src/lib/firestore/schema.ts`). It is **server-set
only** — never written by a client.

| Creation path | isAdmin |
|---|---|
| `registerCompanyCore` — company registration funnel | `true` |
| `acceptInviteCore` — invited colleague | `false` |
| `scripts/grant-backoffice.js` | `true` by default; `--no-admin` writes `false` |
| `scripts/grant-b2b.js` | `true` when the script also creates the company, else `false`; `--admin` forces `true` |

There are no existing accounts in the live project, so no backfill script is needed.
Code treats a missing field as `false`.

**Stored in the Firestore document only — not in Auth custom claims.** Server callables
read the caller's `users/{uid}` document, which is always fresh; a custom claim would
stay stale until the user's ID token refreshed, and no security rule needs the flag.
`buildSessionUser` spreads the profile document, so `session.isAdmin` is available
wherever `useAccount()`/`useAuth()` is — but that copy is a **snapshot taken at
sign-in**: `AuthProvider` reads it with a one-shot `getDoc`, so a promotion or demotion
never reaches it until the app restarts. The client gates that matter (the "Gérer" button
in `ColleaguesScreen`/the colleague-detail routes, and "Supprimer mon compte" in
`AccountScreen`) instead read the viewer's own document **live**, via `useUser(session.id)`
(`onSnapshot`), falling back to the session snapshot only while that read is loading so
nothing flickers into a more-permissive state. The server is always authoritative either
way — this only affects how fast the UI reflects a change.

Deleting a user does **not** touch dossiers, chat messages or Storage:

- `dossiers/{id}.submitter` denormalizes nom / prénom / email / téléphone, and
  `messages/{id}.senderName` is stamped server-side, so history stays readable.
- Storage is company-prefixed (`dossiers/{companyId}/…`), never user-prefixed.
- `dossiers.submittedBy` and `messages.senderId` keep pointing at a uid that no longer
  resolves; nothing reads them for display.
- Pending invitations sent by the deleted user stay valid — an invitation is scoped to
  the company, not to its sender.

## 2. Security rules

Two changes in `firestore.rules`, `match /users/{uid}`:

- **Teammates may read each other.** Today the document is readable only by its owner
  and by the back-office, so a b2b user cannot see a colleague at all. Add
  `|| (isActive() && resource.data.companyId == myCompany())` to the read rule. A
  back-office user listing the back-office team is already covered by `isBackoffice()`.
- **`isAdmin` is not client-writable** — add it to the forbidden `affectedKeys` list
  next to `role` / `companyId` / `status` / `createdAt` in the update rule.

No new composite index: `users where companyId == …` is already used by
`useCompanyUsers`, and `users where role == 'backoffice'` is a single-field query.

New cases in `src/lib/firestore/__tests__/rules.test.ts`:

- an active b2b user reads a colleague of the same company → allowed;
- the same user reads a user of another company → denied;
- the owner updates their own `isAdmin` → denied.

## 3. Cloud Functions — `functions/src/users/`

New module shaped like `functions/src/registration/`: an injected-deps `core.ts` (unit
tested), a Zod `schemas.ts`, a thin `index.ts` wiring the callables.

`RegError`, `RegErrorCode` and `CallerClaims` move from `registration/core.ts` to a
shared `functions/src/errors.ts`, re-imported by the registration files, so the new
module does not depend on the registration one.

**Scope** — the set of users a caller may act on:

- caller `role === "b2b"` → users with the same `companyId`;
- caller `role === "backoffice"` → users with `role === "backoffice"`.

Every callable requires `status === "active"`.

### `setColleagueAdmin({ uid, isAdmin })`

- caller must be an admin; target must be in the caller's scope;
- refuses to demote the **last admin** of the scope —
  "Cette entreprise doit garder au moins un administrateur." (back-office wording:
  "L'équipe Bike-eco doit garder au moins un administrateur.");
- writes `users/{uid}.isAdmin` and `updatedAt`.

### `deleteColleague({ uid })`

- caller must be an admin; target must be in the caller's scope;
- refuses when the target is an admin, or when the target is the caller;
- deletes the Auth user, then the `users/{uid}` document. Nothing else (see §1).

### `deleteMyAccount({})`

- caller must be authenticated and **not** an admin. Unlike the other two, it does
  *not* require `status === "active"`: a colleague still waiting on the company's
  validation must be able to cancel their account;
- deletes the caller's Auth user and profile document, same "keep everything else"
  cascade;
- the client signs out afterwards; the route guard sends it to sign-in.

## 4. Client data layer

- `src/lib/data/useColleagues.ts` — live list for the signed-in user's scope
  (`where companyId == session.companyId` for b2b, `where role == "backoffice"` for
  back-office), **excluding the signed-in user**, sorted by nom then prénom.
- `src/lib/data/useUser.ts` — single live `users/{uid}` document, used by the
  Collaborateur page and by the back-office read-only detail page.
- `src/lib/data/users.ts` — callable wrappers `callSetColleagueAdmin`,
  `callDeleteColleague`, `callDeleteMyAccount`, following `src/lib/data/registration.ts`.
- `roleLabel(user)` pure helper — b2b: `Administrateur` / `Vendeur`; back-office:
  `Administrateur` / `Membre`. Unit tested.

## 5. UI

### Shared pieces extracted

- **`EntityCard`** (`src/components/ui/EntityCard.tsx`) — the existing `CompanyCard`
  visual (title, subtitle, right-hand button) with a configurable button label.
  `CompanyCard` becomes a thin wrapper over it (`actionLabel="Gérer"`), so the
  companies list and page are unchanged.
- **`ColleagueCard`** — `EntityCard` with title `"[Nom] [Prénom]"`, subtitle
  `"Rôle: [Administrateur|Vendeur|Membre]"`, and an optional caller-supplied button
  (no button at all when the viewer may not act).
- **`ConfirmModal`** (`src/components/ui/ConfirmModal.tsx`) — the confirmation modal
  currently inlined in `companies/[id].tsx` (title, body, cancel primary, danger
  action), extracted and reused by that page and by the two new deletion flows.
- **`AccountInfoList`** gains an optional `roleLabel?: string` prop appending a "Rôle"
  row, rather than duplicating the list for colleagues.

### Paramètres (both roles)

`SettingsList` gains a section: title "Mes collaborateurs", outlined button
"Voir mes collaborateurs" → the colleagues list of the caller's group.

### "Mes collaborateurs" page

Routes `src/app/(b2b)/colleagues/index.tsx` and
`src/app/(backoffice)/colleagues/index.tsx`, both rendering a shared
`ColleaguesScreen`. Header title "Mes collaborateurs". One `Section` titled
"Mes collaborateurs" carrying its own loading / error / empty states
("Aucun collaborateur pour le moment."), listing `ColleagueCard`s.

The card's "Gérer" button is rendered **only when the signed-in user is an admin**;
non-admins get a read-only list of names and roles.

### "Collaborateur" page

Routes `src/app/(b2b)/colleagues/[uid].tsx` and
`src/app/(backoffice)/colleagues/[uid].tsx`, both rendering a shared
`ColleagueScreen` with `canManage: true`. Header title "Collaborateur".

- Section "Information collaborateur" — nom, prénom, email, téléphone, rôle.
- Section "Gérer ce collaborateur" (`Section` requires a title; this mirrors
  "Gérer cette entreprise" on the company page) holding the two action buttons:
- Primary button "Ajouter rôle Administrateur" / "Retirer rôle Administrateur"
  depending on the target's current flag.
- Danger button "Supprimer utilisateur", **disabled when the target is an admin**.
  It opens `ConfirmModal`: "Supprimer cet utilisateur ?" /
  "Êtes-vous sûr de vouloir supprimer l'utilisateur [Nom] [Prénom] ?" /
  "Annuler" (primary) / "Supprimer utilisateur" (danger). On success the page pops
  back to the list.

While an action runs, every button on the page is locked and the acting button shows
a spinner — the same `useAsyncAction` + `alertDialog("Action impossible", …)` pattern
as `companies/[id].tsx`. A user that cannot be read renders
"Utilisateur introuvable.".

### Back-office read-only user detail

Route `src/app/(backoffice)/users/[uid].tsx`, rendering `ColleagueScreen` with
`canManage: false`: the information section only (titled "Information vendeur" here —
the user belongs to a company, not to the Bike-eco team), no buttons. Header
title "Détails [Prénom] [Nom]", set per-screen via `<Stack.Screen options={…}>` once
the user document resolves (the pattern used by `add-colleague.tsx`). A flat route, so
`companies/[id]` needs no restructuring.

### Back-office "Entreprise" page revamp

`src/app/(backoffice)/companies/[id].tsx` sections become:

1. "Voulez-vous autoriser cette entreprise à vendre des véhicules" — unchanged,
   pending companies only.
2. **"Information Entreprise"** — the former "Information vendeur", content unchanged,
   title only.
3. **"Vendeurs de cette entreprise"** — a `ColleagueCard` per company user, with a
   "Voir détails" button routing to `/(backoffice)/users/[uid]`. No phone or email
   icons. Empty message "Aucun utilisateur.".
4. "Gérer cette entreprise" — unchanged, active companies only.

"Information vendeur admin" and "Autres utilisateurs de cette entreprise" are removed;
their content is covered by the card list and the detail page. Consequence, accepted:
when validating a pending company the back-office reaches the applicant's email and
phone one tap away (card → "Voir détails") instead of reading it on the page.

`assets/images/icons/phone.svg` (currently untracked) is not needed by this design and
will be deleted.

### Mon compte

"Supprimer mon compte" is wired to `deleteMyAccount` behind `ConfirmModal`
("Supprimer mon compte ?" / "Cette action supprime définitivement votre compte. Vos
dossiers et conversations sont conservés." / "Annuler" / "Supprimer mon compte").
On success the client signs out and the guard routes to sign-in.

For an admin the button is **disabled**, with a line underneath: "Un administrateur ne
peut pas supprimer son compte. Transférez d'abord le rôle administrateur à un
collaborateur."

## 6. Docs kept in sync

- `docs/specs/page-settings.md` — the new "Mes collaborateurs" section.
- `docs/specs/page-colleagues.md` — new page spec.
- `docs/specs/page-colleague.md` — new page spec, incl. the back-office read-only mode.
- `docs/specs/component-card-colleague.md` — new component spec.
- `docs/specs/page-company.md` — the revamped section list.
- `docs/specs/page-my-account.md` — self-deletion is no longer "not available yet".
- `docs/tech/firestore-data-model.md` — `isAdmin`.
- `docs/ops/manage-accounts.md`, `docs/ops/first-backoffice-account.md` — new script
  flags and the admin default.
- Project skills `bike-eco-data` (users read rule), `bike-eco-functions` (the three new
  callables), `bike-eco-auth` (admin gating) — short updates only.

## 7. Verification

Per `docs/tech/verification.md`: `npx tsc --noEmit && npx expo lint && npm test`, plus
`npm run test:rules` for the rules changes, plus regenerating `.expo/types/router.d.ts`
after adding the five route files.

New tests, following the house style (pure logic tested, UI gated by tsc + lint):

- `functions/src/users/core.test.ts` — scope guard, admin-only guard, last-admin guard,
  refusal to delete an admin, refusal to delete oneself, self-delete refused for an
  admin, happy paths.
- `functions/src/users/schemas.test.ts` — payload validation.
- `src/lib/data/__tests__/roleLabel.test.ts` — the four label combinations.
- Rules test cases listed in §2.
