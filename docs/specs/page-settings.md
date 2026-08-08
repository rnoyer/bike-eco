# B2B and Back-office Settings page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Paramètres"
- right : None

## Main section

From top to bottom

### B2B

- Section "Inviter un collaborateur de mon entreprise" (**administrateurs uniquement** —
  la section est masquée pour les autres) :
  - Button secondary : "Inviter" (link to page-add-colleague)
- Section "Mes collaborateurs" (see "Mes collaborateurs" below)
- "Supprimer son compte" lives on page-my-account, not here.

### Bike-eco Backoffice

- Button secondary : "Gérer les entreprises" (link to page-list-companies)
- Section "Inviter un membre de l'équipe Bike-eco" (**administrateurs uniquement** —
  la section est masquée pour les autres) :
  - Button secondary : "Inviter" (link to page-add-colleague)
- Section "Mes collaborateurs" (see "Mes collaborateurs" below)

label : "Région gérée"
Placeholder : none
default value : "Toute la France"
type : dropdown

- "Moitié Nord" (maps to region `NORTH`)
- "Moitié sud" (maps to region `SOUTH`)
- "Toute la France" (no region filter)

behaviour : filters the dossiers shown on the back-office dashboard by region, and drives
push-notification fan-out (see [`feature-push-notifications.md`](feature-push-notifications.md)).
Persisted account-side to `users/{uid}.notificationRegion` — not device-local storage —
so the choice is shared across the member's devices and read live (`useUser`'s
`onSnapshot`), the same document the dashboard filter reads, rather than the auth-session
snapshot.

### Section "Notifications désactivées"

Appears only when the OS push permission is denied (b2b and back-office alike):

- Button outlined : "Ouvrir les réglages" — opens the device's OS settings
  (`Linking.openSettings()`) so the user can re-enable notifications.

Hidden while the permission status is still loading, when it is granted or
undetermined, and on web (where push is unsupported and there is nothing to open).

The permission is **followed, not read once**. Settings is a sibling NativeTab of the
Dashboard and stays mounted, so a mount-only read would miss both of the ordinary ways
the value changes: the Dashboard's own prompt turning it into "denied" (the row would
never appear until a restart) and the user granting it in the OS settings this very row
sent them to (the row would never clear, and no token would ever be registered).
`usePushPermission` therefore subscribes to `subscribeToPushPermission` — published by
every path that learns the OS answer, including `registerPushToken`'s prompt — and
re-reads whenever the app returns to the foreground. `usePushRegistration` retries on the
same foreground signal, but only while it holds no registration and only on an
already-granted permission, so it never re-prompts and never repeats a token write.

### Section "Mes collaborateurs" (b2b and back-office)

The list is rendered inline here — there is no separate "Mes collaborateurs" page.

- Title : "Mes collaborateurs"
- Content : one [`Colleague` card](component-card-colleague.md) per other user of the
  signed-in user's company (b2b) or of the Bike-eco team (back-office), ordered by nom
  then prénom. The signed-in user is never listed — they manage their own account on
  page-my-account.
- Message if no entries : "Aucun collaborateur pour le moment."

Each card carries a "Gérer" button **only when the signed-in user is an administrator**;
it opens page-colleague. A non-admin sees the same list without buttons. The section owns
its own spinner, mapped French error and empty message (component-section).

## Tab bar props

### B2B

From left to right :

- "Dashboard" : store icon, link to: dashboard page (current)
- "Mon compte" : user icon, link to: my-b2b-account page
- "Paramètres" : gear icon, link to: b2b-settings page

### Bike-eco Backoffice

From left to right :

- "Dashboard" : store icon, link to: dashboard page (current)
- "Mon compte" : user icon, link to: my-bo-account page
- "Paramètres" : gear icon, link to: bo-settings page
