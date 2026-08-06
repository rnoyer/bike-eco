# Back-office invitations — design

Date: 2026-08-06
Branch: `feat/manage-users`

Extends the existing invitation flow — today hard-wired to B2B — so a back-office
admin can invite a new member of the Bike-eco team. Invited back-office members are
**not** admins, and go through the same three-step invited-registration funnel as a
B2B colleague.

Restricting who may invite is part of the same change: from now on **only an admin
can send an invitation**, for b2b and back-office alike.

## 1. What exists today

- `sendInviteCore` requires `role === "b2b"`, `status === "active"` and a
  `companyId`; any active b2b user qualifies, admin or not.
- An `invitations/{id}` document always carries a non-null `companyId`.
- `resolveInviteCore` returns `{ email, companyName }`; the client destructures
  `email` only and drops `companyName`.
- `acceptInviteCore` always writes `role: "b2b"` with the invitation's `companyId`,
  `status: "active"` and `isAdmin: false`.
- `register-invited` always lands on `/(b2b)/(tabs)/dashboard`.
- Back-office Paramètres has an "Inviter" button wired to a stub alert
  ("Action non disponible pour le moment.").

There are **no invitations in the live database**, so no backfill or
missing-field fallback is needed: the new `role` field is required from day one.

## 2. Data model

`Invitation` (`src/lib/firestore/schema.ts`) gains `role` and relaxes `companyId`:

| field | type | notes |
|---|---|---|
| `role` | `UserRole` | `"b2b"` \| `"backoffice"` — the role the invitee will get |
| `companyId` | `string \| null` | the company for a b2b invite; **null** for a back-office one |

Everything else (`email`, `invitedBy`, `tokenHash`, `status`, `expiresAt`,
`createdAt`) is unchanged. Both fields are server-written only — invitations are
`read, write: if false` in `firestore.rules`.

`docs/tech/firestore-data-model.md` is updated to match.

## 3. Security rules and indexes

**No change.** Invitations are unreachable from any client, and the callables read
them with the Admin SDK. No new query shape, so no new composite index.

`deleteCompanyCore`'s `deleteInvitations(companyId)` sweep is unaffected: a
back-office invitation has `companyId: null` and can never match a company id.

## 4. Cloud Functions — `functions/src/registration/`

### `sendInviteCore` — admin gate + role

Two changes:

- **Admin gate, both roles.** The caller must be `status === "active"` **and** an
  admin. `isAdmin` lives only on the `users/{uid}` document, never in the custom
  claims (see the user-management design), so `Deps` gains
  `getUserIsAdmin(uid): Promise<boolean>` and the core awaits it. A non-admin gets
  `permission-denied` — "Seul un administrateur peut inviter."
- **Role-aware write.** The invitation's `role` is the caller's role.
  `b2b` still requires a `companyId` (unchanged error when it is missing);
  `backoffice` writes `companyId: null`. Any other role is rejected.

### `StoredInvitation` and `findInvitationByHash`

`StoredInvitation` gains `role: UserRole`, `companyId` becomes nullable, and
`companyName` is replaced by **`organisationName`**: the company's `name` for a b2b
invitation, the constant `"Bike-eco"` for a back-office one. The real dep skips the
`companies/{id}` lookup entirely when `companyId` is null — today it would issue a
`doc(null)` read and throw.

### `resolveInviteCore`

Returns `{ email, role, organisationName }`. Expiry handling is unchanged (the
document is deleted and the caller gets the same "Code d'invitation invalide ou
expiré." either way, so an invalid code still leaks nothing about the invitation).

### `acceptInviteCore`

The profile document and the claims are built from `inv.role`:

| | b2b invitee | back-office invitee |
|---|---|---|
| `role` | `"b2b"` | `"backoffice"` |
| `companyId` | invitation's | `null` |
| `status` | `"active"` | `"active"` |
| `isAdmin` | `false` | `false` |

The Google-account check, the password path, and the delete-the-invitation-on-success
step are identical for both. A back-office invitee is active the moment they finish
registering — there is no validation step, exactly as for a b2b invitee.

### `sendInviteEmail(to, code, organisationName)`

Body becomes "Vous avez été invité à rejoindre {organisationName} sur Bike-eco." so a
back-office invitee is not told they are joining "une entreprise".

## 5. Client

### Data layer

`callResolveInvite` returns `{ email, role, organisationName }`
(`src/lib/data/registration.ts`). `callSendInvite` is unchanged — the server derives
the role from the caller.

### `(auth)/invite-code.tsx`

The screen renders **before** the code is resolved, so it cannot name the
organisation. Its subtitle becomes role-neutral: "Saisissez le code à 6 caractères
reçu par email pour rejoindre votre équipe." On success it forwards `role` and
`organisationName` to `register-invited` alongside `code` and `email`.

### `(auth)/register-invited.tsx`

- Step 1's subtitle becomes "Vous rejoignez {organisationName}." when the param is
  present, falling back to the current copy otherwise.
- "Aller à l'accueil" routes to `/(backoffice)/(tabs)/dashboard` when
  `role === "backoffice"`, `/(b2b)/(tabs)/dashboard` otherwise. Both the password
  path (sign in, then route) and the Google path (refresh session, then route) are
  otherwise untouched.

The funnel itself — email + password/Google, then nom / prénom / téléphone, then
confirmation — is **shared as-is** by both roles. The module keeps its
`b2b-invited-registration` name; renaming it would touch a dozen files for no
behavioural gain.

### Paramètres

`SettingsScreen` computes the viewer's live admin flag with the pattern already used
by `ColleaguesScreen` and `AccountScreen` — `useUser(session.id)` via `onSnapshot`,
falling back to the session snapshot only while that read is loading, so the section
never flickers into a more-permissive state. It passes `canInvite` down.

`SettingsList`:

- hides the invite `Section` entirely when `canInvite` is false. **This also removes
  the invite button for non-admin b2b users**, who have it today — an accepted,
  intended behaviour change.
- role-aware section title: "Inviter un collaborateur de mon entreprise" (b2b) /
  "Inviter un membre de l'équipe Bike-eco" (back-office).

`(backoffice)/(tabs)/settings.tsx` replaces its stub alert with
`router.push("/(backoffice)/add-colleague")`.

### New routes

- **`src/app/(backoffice)/add-colleague.tsx`** — mirrors the b2b route: header
  "Inviter un collègue", `AddColleagueForm`, `useInvite`, and on success
  `router.replace("/(backoffice)/invite-sent")`.
- **`src/app/(backoffice)/invite-sent.tsx`** — `ConfirmationView` with "C'est
  envoyé !" / "L'invitation a bien été envoyée." / 1500 ms /
  `/(backoffice)/(tabs)/dashboard`. A separate route because the existing
  `(backoffice)/confirmation.tsx` is hard-coded to dossier wording ("Le dossier a
  bien été mis à jour.").

Adding route files requires regenerating typed routes — see
`docs/tech/verification.md`.

## 6. Tests

New cases in `functions/src/registration/core.test.ts`:

- `sendInviteCore` — an active **non-admin** b2b caller is denied; an active
  non-admin back-office caller is denied; an active b2b admin still writes an
  invitation with `role: "b2b"` and its `companyId`; an active back-office admin
  writes `role: "backoffice"`, `companyId: null`.
- `resolveInviteCore` — a back-office invitation resolves to
  `organisationName: "Bike-eco"` without any company read.
- `acceptInviteCore` — a back-office invitation produces a profile with
  `role: "backoffice"`, `companyId: null`, `status: "active"`, `isAdmin: false`, and
  matching claims; the invitation is deleted.

Security-rules tests are unchanged (no rule changed). The `tsc` + lint + test gate in
`docs/tech/verification.md` covers the rest.

## 7. Docs to update in the same change

- `docs/specs/page-add-colleague.md` — note that the page serves both roles and is
  reachable by admins only.
- `docs/specs/page-settings.md` — invite section is admin-only, title differs per role.
- `docs/specs/form-b2b-invited-registration.md` — the code screen's neutral subtitle,
  the "Vous rejoignez {organisation}" step-1 subtitle, and the role-dependent
  destination after "Aller à l'accueil".
- `docs/tech/firestore-data-model.md` — `invitations` gains `role`, `companyId`
  nullable.
- `docs/ops/first-backoffice-account.md` — the bootstrap script is still the only way
  to create the *first* back-office account; subsequent ones can now be invited from
  the app by an admin.

## 8. Out of scope

- Revoking or listing pending invitations.
- Inviting someone as an admin directly — a new back-office member is promoted after
  the fact from the Collaborateur page (`setColleagueAdmin`).
- Any change to the b2b company-registration funnel.
