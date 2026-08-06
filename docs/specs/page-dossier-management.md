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

## Loading and error states

While the dossier read is in flight the page shows a centered spinner. If the
read fails it shows the mapped French error; if the dossier does not exist,
"Dossier introuvable.".

"Mettre à jour" shows a spinner in place of its label while the write is in
flight and cannot be tapped twice. The write is bounded by the shared 15s
timeout, so offline it fails with a network message instead of hanging: the page
only navigates to the confirmation screen once the update is acknowledged.

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
