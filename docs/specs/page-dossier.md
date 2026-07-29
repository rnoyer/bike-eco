# B2B and Back-office Dossier page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Dossier"
- right : None

## Main section

Scrollable view with all forms information related to the vehicule only. At the top,
a horizontal photo carousel of the dossier's photos (paged, with page dots and — when
present — the status badge overlaid). The carousel is interactive: tapping a photo
opens **that photo** full screen with pinch / double-tap zoom and a "✕" to close.
The full-screen view shows one photo at a time — swiping between photos happens in
the inline carousel, not in the full-screen view.

Below the vehicle-name heading, the data sits in two `Section`s, each a compact list of :

- title : field label
- value : field value

### "Informations véhicule"

The vehicle's form data : marque, modèle, cylindrée, année, kilométrage, électrique,
accessoires, état, carte grise, contrôle technique, prix souhaité, commentaires.

### "Informations vendeur"

Who filed the dossier, in this order : entreprise, nom, prénom, email, téléphone,
date de soumission (`JJ MMM AAAA hh:mm`, e.g. "26 juil. 2026 14:30").

Email and téléphone are read from the dossier's denormalized `submitter`, not from the
submitter's `users/{uid}` doc — that document is readable only by its owner and the
back-office, so a B2B teammate viewing a colleague's dossier could not fetch it.

Any missing value renders as "—".

## Loading and error states

While the dossier read is in flight the page shows a centered spinner. If the
read fails it shows the mapped French error; if the dossier does not exist,
"Dossier introuvable.".

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
