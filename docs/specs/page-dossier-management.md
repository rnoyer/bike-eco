# Back-office Dossier management specifications

This page to manage status and store the validated price.

## Navbar props

- Left : Left arrow icon linked to current page-dossier
- middle : "Statut dossier"
- right : None

## Main section

From top to bottom :

label : "Région attribuée"
Placeholder : none
default value : the dossier's current region — "Nord" (NORTH) or "Sud" (SOUTH)
type : dropdown

- "Nord"
- "Sud"

A Bike-eco team member can reassign the dossier to the other region here. On
"Mettre à jour" the dossier's `region` is updated accordingly (which moves it
between the region-filtered dossier lists on the back-office dashboard).

label : "Statut du dossier"
Placeholder : none
default value : "a traiter"
type : dropdown

- "a traiter"
- "en cours"
- "cloturé"

  label : "Prix d’achat validé"
  placeholder : "€"
  default value : null
  type : Input number
  unit : "€"
  mandatory : no

  Primary Button : "Mettre à jour", update dossier region, statut and validated price

The update also writes `updatedBy` with the caller's uid, alongside `region` /
`status` / `validatedPrice` / `updatedAt`. The status- and price-change notification
triggers (see [`feature-push-notifications.md`](feature-push-notifications.md)) read it
to skip the back-office member who made the change.

### Gérer ce dossier

At the bottom of the screen, below "Mettre à jour", a section titled "Gérer ce
dossier" holds one danger button, "Supprimer ce dossier". Back-office only —
this whole page is.

Tapping it opens a confirmation modal:

- title: "Supprimer ce dossier ?"
- message: "Cette action supprime définitivement le dossier, ses conversations
  et ses documents associés."
- "Annuler" closes the modal and changes nothing.
- "Supprimer ce dossier" (danger) calls the `deleteDossier` callable.

The callable deletes, in this order, the dossier's Storage folder
(`dossiers/{companyId}/{dossierId}/` — every photo, the thumbnail, and every
message attachment) and then the dossier document with its `messages` and
`mutes` subcollections. The `companyId` is read server-side from the stored
document, never taken from the request.

While the delete is in flight the button spins and "Mettre à jour" is disabled,
so the two writes cannot race. On success the page redirects to the
confirmation screen — "Dossier supprimé" / "Le dossier a bien été supprimé." —
which auto-redirects to the dashboard after 1500 ms. On failure an alert titled
"Suppression impossible" shows the mapped French error and the page stays put,
so the action can be retried.

No notification is sent: the seller is not told their dossier was deleted.

## Loading and error states

While the dossier read is in flight the page shows a centered spinner. If the
read fails it shows the mapped French error; if the dossier does not exist,
"Dossier introuvable.".

"Mettre à jour" shows a spinner in place of its label while the write is in
flight and cannot be tapped twice. The write is bounded by the shared 15s
timeout, so offline it fails with a network message instead of hanging: the page
only navigates to the confirmation screen once the update is acknowledged.

The dossier read is a live listener, so a successful delete makes it fire with
no document. The page holds the spinner from the moment the delete succeeds
until the redirect lands, rather than flashing "Dossier introuvable." at a user
whose deletion just worked.

## Tab bar props

### B2B

- link 1 :
  - motorbike icon
  - "Dossier"
  - Link to current page-dossier

- link 2 :
  - mail icon
  - "Messages"
  - Link to current page-chat

### Bike-eco Backoffice

- link 1 :
  - motorbike icon
  - "Dossier"
  - Link to current page-dossier

- link 2 :
  - mail icon
  - "Messages"
  - Link to current page-chat

  - link 3 :
  - folder-open icon
  - "statut dossier"
  - Link to current page-dossier-management
