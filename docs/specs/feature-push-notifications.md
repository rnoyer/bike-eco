# Push notifications

Five events push a native notification to the people who care: a new company
registration, a new dossier, a new chat message, a status change and a
validated-price change. Two roles receive them, b2b and back-office. The server sends
FCM directly via `firebase-admin` from Firestore triggers in `functions/`; the client
receives and presents them with `@react-native-firebase/messaging` (token, receipt,
tap routing) plus `expo-notifications` (permission, Android channel, foreground
presentation).

## Recipient rules

| Event | Recipients |
|---|---|
| Company created | back-office where `notificationRegion ∈ {company.region, null}` |
| Dossier created | back-office where `notificationRegion ∈ {dossier.region, null}` |
| Message created | back-office in the dossier's région, **plus** — only when the sender is back-office — the active users of `dossier.companyId`; minus the sender, minus mutes |
| `status` changed | back-office in the dossier's région **+** active users of `dossier.companyId`; minus `updatedBy`, minus mutes |
| `validatedPrice` changed | same candidate set as `status` |

"Active" means `users/{uid}.status === "active"`; a pending account is never a recipient.

A single management submit that changes both `status` and `validatedPrice` sends **two**
notifications, because the spec words them as two distinct messages.

Two resolved readings of the original spec:

- **B2B chat copy is fixed to "de Bike-eco"**, so B2B users are notified only for
  *back-office* messages. A b2b colleague's message notifies the back-office but not
  their own teammates — otherwise a teammate's message would falsely read as coming from
  Bike-eco.
- **Status copy is role-dependent, like the chat copy.** The label goes through
  `viewerStatus`, so a b2b recipient is never told "À traiter" — the back office's own
  working state, which their dossier screen renders as "En cours". The management
  dropdown can move a dossier back to "À traiter", so this is reachable, and without the
  projection the notification would contradict the screen it links to. `dispatch` groups
  by rendered content, so the two variants split into two multicasts on their own.
- **"Subscribed by default" is scoped to the dossiers you manage.** Back-office dossier
  notifications respect `notificationRegion`; without that, every back-office user would
  be paged about every chat message in the country. B2B users are unaffected — they only
  ever see their own company's dossiers.

## Copy

`functions/src/notifications/copy.ts`, pure builders. Shared helper:

```ts
const moto = (v: DossierVehicle) =>
  [v.marque, v.modele].filter(Boolean).join(" ") || "Moto non renseignée";
```

| Event | Title (line 1) | Body (remaining lines, `\n`-joined) |
|---|---|---|
| Company created | `1 nouvelle entreprise s'est inscrite` | `{company.name}`<br>`{company.createdByName}` |
| Dossier created | `Une nouvelle proposition d'achat vient d'être publié.` | `Entreprise {company.name}`<br>`Vendeur : {prenom} {nom}` |
| Message → back-office | `1 nouveau message de {prenom} {nom}` | `Pour la {moto}` |
| Message → b2b | `1 nouveau message de Bike-eco` | `Pour la {moto}` |
| Status changed | `Le statut de la {moto} a évolué` | `Nouveau statut: {STATUS_LABELS[viewerStatus(status, recipientRole)]}` |
| Price changed | `Le prix validé de la {moto} a évolué` | `Prix validé: {euros(validatedPrice)}` |

## Data

- `users/{uid}.notificationRegion: Region | null` — back-office only; the "région gérée"
  a member manages, `null` meaning "Toute la France". Drives both the dashboard filter
  and notification fan-out. Set at account creation — the optional "Région gérée" field
  of the invited-registration form (`form-b2b-invited-registration.md`, back-office
  invitations only; `acceptInvite` ignores it for a b2b one) or `--region north|south|all`
  on `scripts/grant-backoffice.js` — and changed afterwards in Paramètres
  (`page-settings.md`). Absent on accounts created before the field existed, which reads
  as `null`.
- `users/{uid}/pushTokens/{deviceId}` — one row per device (`{ token, platform,
  updatedAt }`), keyed by a random device id minted once so a rotated FCM token updates
  in place instead of orphaning a row. Deleted on sign-out.
- `dossiers/{dossierId}/mutes/{uid}` — presence means muted, absence means subscribed
  (`{ createdAt }`); this makes "subscribed by default" free, with no backfill and no
  write at dossier creation.
- `dossiers/{dossierId}.updatedBy: string` — the uid that last wrote the dossier, set to
  `submittedBy` at creation and to the back-office caller on every management update; lets
  the `onDocumentUpdated` trigger (which carries no auth context) skip the person who made
  the change.

## Gotchas

- Every trigger must pass `database: "bike-eco-db"` — a trigger declared without it binds
  to `(default)` and silently never fires.
- Triggers run `retry: false` — a duplicate push is worse than a missed one, and a
  notification has no compensating action.
- `STATUS_LABELS`, `euros` and `viewerStatus` are duplicated in
  `functions/src/notifications/labels.ts` and must be kept in sync with
  `src/lib/ui/format.ts`.
- **Only one banner per foreground message.** The FCM payload carries both a
  `notification` and a `data` block, so on iOS the push reaches expo-notifications'
  `UNUserNotificationCenter` delegate as well as RNFB's `onMessage`. The handler answers
  `shouldShowBanner: false` for a remote trigger (`isRemoteNotification`) so the OS does
  not present it: the *local* copy scheduled by `useForegroundNotifications` is the one
  that carries the "don't ping me for the thread I'm reading" suppression. Android never
  reaches that branch — expo's messaging service declares `android:priority="-1"`, so
  RNFB wins the service race and expo never sees the remote message.
- **Three tap entry points, not two.** `getInitialNotification` (cold start) and
  `onNotificationOpenedApp` (backgrounded) only fire for FCM-delivered taps; a tap on the
  *foreground* banner is a tap on a locally scheduled notification and reaches only
  expo's `addNotificationResponseReceivedListener`. All three feed the same parked-payload
  drain; the response listener filters remote triggers out so an iOS tap is not routed twice.
- **The parked payload drains only once the auth guard has settled.** Auth resolving
  exposes `role`/`status` and drops the splash in one commit, and a route pushed in that
  commit is overwritten by the guard's `router.replace`, which still sees the pre-push
  `segments`. `AuthGate` passes `redirectFor(...) === null` into `useNotificationRouting`
  so a cold-start tap lands on its target instead of the dashboard.
- **`unregisterPushToken` is time-bounded.** `signOut` awaits it, and offline Firestore
  buffers a `deleteDoc` that then neither resolves nor rejects — an unbounded await would
  spin the "Se déconnecter" button forever. The delete is issued before `fbSignOut` (the
  owner-only rule needs the credential) but never blocks on it.
- **Deleting an account must be recursive.** `users/{uid}/pushTokens` is a subcollection,
  so a plain `.delete()` on the profile leaves device tokens behind as personal data.
  `deleteColleague`/`deleteAccount`, the company cascade, and both ops scripts use
  `recursiveDelete`.
- `messaging/invalid-argument` must **not** be added to `DEAD_TOKEN_CODES` in
  `send.ts`, even though it looks like an obviously-dead-token code.
  `sendEachForMulticast` sends one message per token but validates the shared
  payload once, so a payload-level `INVALID_ARGUMENT` (an over-long body, an empty
  title from a copy regression) returns on **every** response in the batch —
  pruning on it would delete every token row at once, silencing every back-office
  device simultaneously. A regression test in `send.test.ts` pins this; re-adding
  the code will turn it red.
