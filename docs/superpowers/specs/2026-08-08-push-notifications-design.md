# Push notifications — design

Cross-platform (iOS + Android) push notifications for the five events the business
cares about: a new company registration, a new dossier, a new chat message, a status
change and a prix-validé change.

Client: `expo-notifications` (permission, Android channel, foreground presentation) +
`@react-native-firebase/messaging` (FCM token, message receipt, tap routing).
Server: Firestore triggers in `functions/` sending through `firebase-admin` messaging.

---

## 1. Architecture

Every notification is emitted by a **Firestore trigger**, never inline in a callable.
Two of the five events — dossier creation and the status / prix-validé update — are
plain client-side writes with no callable to hook, so triggers are the only seam that
covers all five uniformly. They also retry independently of the write that caused them.

```
client write ──▶ Firestore (bike-eco-db) ──▶ v2 trigger ──▶ resolveRecipients()
                                                              │
                                              buildPayload(event, recipientRole)
                                                              │
                                              collect FCM tokens ──▶ admin.messaging()
                                                                      .sendEachForMulticast()
                                                              │
                                              prune tokens returning
                                              registration-token-not-registered
```

App data lives in the **named `bike-eco-db`** database, so every trigger must pass
`database: "bike-eco-db"`. A trigger declared without it binds to `(default)` and
silently never fires — this is the single most likely way to lose a day on this feature.

New package `functions/src/notifications/`, following the `core.ts` (pure,
dependency-injected, unit-tested) + `index.ts` (Firestore / admin wiring) split already
used by `messages/` and `registration/`.

### Transport choice

FCM direct via `firebase-admin`, not the Expo Push Service. This requires
`@react-native-firebase/messaging`: on iOS, `expo-notifications`'
`getDevicePushTokenAsync()` returns a raw APNs device token, which `firebase-admin`
cannot address. RNFB 26.1.0 declares `expo >=47` as a peer and its own docs point at
`expo-notifications` for permissions, so the two are designed to coexist.

---

## 2. Data model changes

### `users/{uid}.notificationRegion`

```ts
notificationRegion: Region | null   // null = "Toute la France"
```

Replaces the device-local kv-store région preference outright. The back-office Settings
picker writes it, the dashboard filter reads it off the session, and notification
fan-out queries it. One source of truth, so a user can never view NORTH dossiers while
being paged about SOUTH ones.

Already client-writable under the existing owner-update rule (`notificationRegion` is
not in the forbidden-keys list). Only read for back-office users; a value on a b2b
profile is inert.

`region-store.ts` and `region-store.web.ts` are **deleted**. `useRegionFilter` is
rewritten to read `session.notificationRegion` and write via `updateDoc(userDoc(uid))`
with optimistic local state; its `ready` flag becomes the session's `!loading`.

### `users/{uid}/pushTokens/{deviceId}`

```ts
{ token: string; platform: "ios" | "android"; updatedAt: Timestamp }
```

`deviceId` is a random id minted once into kv-store (same pattern as the old
`region-store.ts`), so a rotated FCM token updates its doc in place instead of orphaning
a row. Deleted on sign-out.

### `dossiers/{dossierId}/mutes/{uid}`

```ts
{ createdAt: Timestamp }
```

**Absence means subscribed.** That is what makes "subscribed by default" free — no
backfill, no write on dossier creation, and no per-user fan-out cost. One subcollection
read per event resolves every candidate recipient's state.

### `dossiers/{dossierId}.updatedBy`

```ts
updatedBy: string   // uid
```

`onDocumentUpdated` carries no auth context, so without this field there is no way to
honour the spec's "done by any back-office member **but him**". Set on creation to
`submittedBy` for consistency.

### Security rules

- `updatedBy` joins the `hasOnly([...])` allow-list on the dossier update rule, and must
  equal `request.auth.uid`.
- `dossiers/{id}/mutes/{uid}`: read and write only by that uid, and only when they can
  already read the parent dossier (reuse `isDossierParticipant`).
- `users/{uid}/pushTokens/{deviceId}`: read and write by the owner only. Not readable by
  the back-office — nothing in the app needs it, and a push token is a device handle.

---

## 3. Events, recipients and copy

### Recipient rules

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
- **"Subscribed by default" is scoped to the dossiers you manage.** Back-office dossier
  notifications respect `notificationRegion`; without that, every back-office user would
  be paged about every chat message in the country. B2B users are unaffected — they only
  ever see their own company's dossiers.

### Copy

`functions/src/notifications/copy.ts`, pure builders. Shared helper:

```ts
const moto = (v: DossierVehicle) =>
  [v.marque, v.modele].filter(Boolean).join(" ") || "Moto non renseignée";
```

People render as **prénom nom**, matching the rest of the app (`senderName` in
`messages/core.ts`, `createdByName` on `Company`). The original spec wrote
`[nom] [prenom]`; that is read as a list of the fields involved, not an ordering.

The company and dossier events read their person from the denormalized field already on
the document — `company.createdByName` and `dossier.submitter` — so neither trigger
needs a second read of `users/{uid}`.

| Event | Title (line 1) | Body (remaining lines, `\n`-joined) |
|---|---|---|
| Company created | `1 nouvelle entreprise s'est inscrite` | `{company.name}`<br>`{company.createdByName}` |
| Dossier created | `Une nouvelle proposition d'achat vient d'être publié.` | `Entreprise {company.name}`<br>`Vendeur : {prenom} {nom}` |
| Message → back-office | `1 nouveau message de {prenom} {nom}` | `Pour la {moto}` |
| Message → b2b | `1 nouveau message de Bike-eco` | `Pour la {moto}` |
| Status changed | `Le statut de la {moto} a évolué` | `Nouveau statut: {STATUS_LABELS[status]}` |
| Price changed | `Le prix validé de la {moto} a évolué` | `Prix validé: {euros(validatedPrice)}` |

`STATUS_LABELS` and the `euros` formatter live in `src/lib/ui/format.ts` and must be
**duplicated** into `functions/src/notifications/`, the way `functions/src/regions.ts`
already duplicates the département map. Both copies carry the same "keep in sync"
comment.

---

## 4. Native setup

Packages: `@react-native-firebase/app` and `@react-native-firebase/messaging` (26.1.0),
plus `expo-notifications`.

`app.json` already declares `ios.googleServicesFile` and `android.googleServicesFile`,
which is exactly what the RNFB config plugin consumes. Plugins to add:

- `@react-native-firebase/app`
- `expo-notifications`, configured with a 96×96 all-white transparent PNG notification
  icon, the brand tint colour, and `defaultChannel: "default"`.

The JS `firebase` SDK (auth + Firestore) and the native RNFB app coexist; RNFB is used
**only** for messaging. Adding these native modules requires `npx expo run:android` /
`npx expo run:ios` — a Metro reload does not include native code.

**Build risk, to prove first:** RNFB on iOS may require `useFrameworks: "static"` in
`expo-build-properties`, which can conflict with the existing `extraPods`
`modular_headers` entries for `GoogleUtilities` and `RecaptchaInterop`. A throwaway iOS
build with the packages installed and nothing else wired is the first task in the plan,
so a pod-resolution dead end surfaces before any product code is written.

---

## 5. Client modules — `src/lib/notifications/`

| Module | Role |
|---|---|
| `deviceId.ts` | Random id minted once into `expo-sqlite/kv-store`. |
| `pushToken.ts` (+ `.web.ts` no-op) | Android channel **first** — the Android 13+ prompt does not appear until a channel exists — then permission, then `messaging().getToken()`, then upsert `users/{uid}/pushTokens/{deviceId}`. Subscribes `onTokenRefresh` to re-upsert. `unregister(uid)` deletes the doc on sign-out. |
| `notificationRouting.ts` | **Pure.** `resolveRoute(data, role)` → `/(backoffice)/companies/[id]`, `/(b2b)`\|`/(backoffice)/dossier/[id]`, or `.../dossier/[id]/chat`. |
| `useNotificationRouting.ts` | Mounted in the authenticated layout. `onNotificationOpenedApp` plus `getInitialNotification()` for a cold start. Holds the pending route until the session is loaded and active, otherwise the route guard bounces the navigation to sign-in. |
| `useForegroundNotifications.ts` | `onMessage` → present locally with `scheduleNotificationAsync({ trigger: null })`, **suppressed when `usePathname()` already matches the target route** — otherwise the user is banner-spammed for the chat thread they are reading. |

Web is a no-op throughout, via the `.web.ts` sibling pattern already used by
`region-store.web.ts` and `googleSignIn.web.ts`.

Permission is requested on **first authenticated dashboard load**, so the OS dialog
lands with context. A denial is a permanent silent no-op — the app never re-prompts.

---

## 6. UI

### Dossier subscription toggle

`PhotoCarousel` gains an optional `topLeft` slot, mirroring the existing absolutely
positioned `badge` in the top right. `DossierDetailScreen` (shared by both roles) passes
a `DossierMuteButton` into it.

The button reuses `InfoContactRow`'s icon-button styling — brand-tint fill, hairline
border, `tokens.radius.sm`. That `Pressable` is extracted into a shared `IconButton` so
the contact buttons and the bell cannot drift apart. Icons `bell-ring.svg` (subscribed)
and `bell-off.svg` (muted) are already committed on this branch.

`useDossierMute(dossierId)` → `{ muted, toggle, pending }`. Live via `onSnapshot` on the
single mute doc, optimistic on toggle. Available to both roles.

### Settings

The back-office région picker switches from the kv-store to the user-doc write described
in §2. One additional row appears only when notification permission is denied, opening
`Linking.openSettings()`.

---

## 7. Error handling

Triggers run with **`retry: false`**. A duplicate push is worse than a missed one, and a
notification has no compensating action.

`sendEachForMulticast` is chunked at 500 tokens per call. Per-token responses of
`messaging/registration-token-not-registered` or `messaging/invalid-argument` delete the
offending token document.

Client-side, every failure — permission refusal, token write, local presentation — is
logged and never surfaced in the UI. Notifications are an enhancement; they must not
produce an error state on a working screen.

---

## 8. Testing

Per `docs/tech/verification.md`: pure logic is unit-tested, UI is gated by
`npx tsc --noEmit && npx expo lint && npm test`.

- `functions/src/notifications/core.test.ts` — recipient resolution: région match and
  `null` = all, mute filtering, sender / `updatedBy` exclusion, role-dependent copy
  selection, the b2b-only-hears-from-back-office rule.
- `functions/src/notifications/copy.test.ts` — every string in §3, including the
  `"Moto non renseignée"` fallback and the `euros` / `STATUS_LABELS` formatting.
- `src/lib/notifications/notificationRouting.test.ts` — each target shape resolved per
  role, and an unknown target ignored rather than throwing.
- `src/lib/firestore/__tests__/rules.test.ts` — `mutes/{uid}` owner-only, `pushTokens`
  owner-only and unreadable by the back-office, `updatedBy` forced to the caller's uid,
  and the existing dossier-update allow-list still rejecting anything else.
- `src/lib/data/__tests__` — `useRegionFilter` rewritten against the user doc.

No new route files are added, so `.expo/types/router.d.ts` does not need regenerating.

### Docs kept in sync in the same change

- `docs/specs/page-dossier.md` — the bell toggle on the carousel.
- `docs/specs/page-settings.md` — the région picker's new backing store, and the
  permission row.
- `docs/specs/page-dossier-management.md` — `updatedBy` written alongside the update.
- New `docs/specs/feature-push-notifications.md` — the event → recipient → copy table as
  the product source of truth.
- `AGENTS.md` — the new spec listed under "Page / component specs".
