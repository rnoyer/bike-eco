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
| Status changed | `Le statut de la {moto} a évolué` | `Nouveau statut: {STATUS_LABELS[status]}` |
| Price changed | `Le prix validé de la {moto} a évolué` | `Prix validé: {euros(validatedPrice)}` |

## Data

- `users/{uid}.notificationRegion: Region | null` — back-office only; the "région gérée"
  a member manages, `null` meaning "Toute la France". Drives both the dashboard filter
  and notification fan-out.
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
- `STATUS_LABELS` and `euros` are duplicated in `functions/src/notifications/labels.ts`
  and must be kept in sync with `src/lib/ui/format.ts`.
