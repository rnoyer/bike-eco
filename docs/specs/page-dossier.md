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

### "M'envoyer par email" — back office only

Below the last card, a back-office reader gets a primary button, `M'envoyer par
email`, which mails them a recap of the dossier at the address on their own
account. A b2b user has no such button.

The button spins while the `sendDossierRecap` callable runs. On success the app
goes to [page-confirmation](page-confirmation.md) — "Récapitulatif envoyé" /
"Récapitulatif envoyé à votre adresse email" — which returns to this dossier
after 1.5 s. On failure an alert shows the French error and the reader stays
put.

Only the dossier id is sent: the recipient is resolved server-side from the
caller's own account, so the address is never in the client's hands — which is
why the confirmation says "votre adresse email" instead of naming the mailbox.
The email itself is specified in
[the design doc](../superpowers/specs/2026-08-11-dossier-recap-email-design.md).

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

Eleven parts, identical for both roles — nothing in this card branches on role.

1. Liste d'information : prix souhaité, marque, modèle et cylindrée, immatriculation,
   année, kilométrage, déjà en stock.
2. Repliable : électrique → batterie présente, chargeur présent.
3. Liste d'information : état.
4. Comments : nature de la panne — **only when l'état est "En Panne"**.
5. Repliable : carte grise → au nom du garage.
6. Repliable : contrôle technique → moins de 6 mois, résultat obtenu.
7. Liste d'information : certificat de non-gage, carnet d'entretien, facture d'entretien.
8. Repliable : clés de contact → clé noire, clé marron, clé rouge.
9. Repliable : clé main libre (keyless) → code, clé de secours.
10. Comments : commentaires véhicule.
11. Comments : commentaires complémentaires.

Every repliable part ([`InfoCollapsibleRow`](component-info-card.md)) is collapsible only
when its own answer is "oui" — the funnel leaves each sub-answer `null` otherwise, so
there would be nothing to reveal. A "non" or "—" answer renders as a plain row with no
button, keeping its own hairlines so the card's shape is the same for every dossier.

The "carte grise" sub-row and the keyless sub-rows are worded for a dealer: dossiers
only ever come from the B2B funnel, which asks whether the déclaration d'achat was
filed under the garage's name rather than whether the carte grise is in the seller's
own, and which collects the keyless system as two checkboxes ("Code", "Clé de
secours") rather than a count. "Au nom du garage" is deliberately short — an
`InfoRows` label never shrinks, so a full-sentence label pushes its value off the
card.

"Modèle et Cylindrée" is a single row, mirroring the B2B submission form — which is the
only source of dossiers — where both are one field (`vehicle.modele`).

"Commentaires véhicule" is `vehicle.accessoires`, which holds the funnel's step-2
free-text "Commentaires (Ex. État de la moto)". The B2B funnel collects no accessories,
so the row is labelled for what the field actually contains; there is no "Accessoires"
row.

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
