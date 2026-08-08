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

The carousel also carries the notification subscription toggle: a bell button in the
**top-left** corner, opposite the status badge, using the same icon-button treatment as
the contact rows (see [`component-info-card.md`](component-info-card.md)). Bell-ring
means subscribed (the default); bell-off means muted. Present for both roles, and
disabled until the mute state has loaded.

Below the vehicle-name heading, the data sits in three [`InfoCard`](component-info-card.md)s.

**Their order differs by role.** The back office reads the vehicle first; a b2b user is
following up on their own submission, so its status comes first :

- **B2B** : Informations Dossier, Informations véhicule, Informations vendeur.
- **Bike-eco Backoffice** : Informations véhicule, Informations vendeur, Informations Dossier.

### "Informations Dossier"

One part (liste d'information) : date de soumission (`JJ MMM AAAA hh:mm`, e.g.
"26 juil. 2026 14:30"), statut ("À traiter" / "En cours" / "Clôturé", as plain text —
not the coloured badge), prix validé, région ("Nord" / "Sud").

**A b2b user never sees "À traiter".** `a_traiter` is the back office's own working
state, so for a b2b viewer a dossier reads "En cours" until it is clôturé — in this
row _and_ in the carousel's badge (which then also takes the blue `en_cours`
palette). The back office sees the three real statuses.

Read from the live dossier snapshot, so a back-office update on
[page-dossier-management](page-dossier-management.md) re-renders this card immediately.

### "Informations véhicule"

Four parts :

1. Liste d'information : marque, modèle et cylindrée, année, kilométrage, électrique.
2. Comments : accessoires.
3. Liste d'information : état, carte grise, contrôle technique, prix souhaité.
4. Comments : commentaires.

"Modèle et Cylindrée" is a single row, mirroring the B2B submission form — which is the
only source of dossiers — where both are one field (`vehicle.modele`).

### "Informations vendeur"

Who filed the dossier, in three parts :

1. Liste d'information : entreprise, nom, prénom.
2. Téléphone, with a call button on the right.
3. Email, with a mail button on the right.

Email and téléphone are read from the dossier's denormalized `submitter`, not from the
submitter's `users/{uid}` doc — the doc can be gone by the time the dossier is viewed (a
deleted colleague's `users/{uid}` is removed but their dossiers are kept), so the
denormalized copy is the only value guaranteed to still exist.

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
