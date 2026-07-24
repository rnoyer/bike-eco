# B2B and Back-office My-account page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Mon Compte"
- right : None

## Main section

From top to bottom

- Section "Mon compte" : compact list of the user's personal info — Nom / Prénom / Email / Téléphone.
- Section "Informations [nom entreprise]" (B2B only, i.e. the user has a `companyId`; hidden for back-office
  users) : compact list of the user's company info — SIRET / Département / Ville.

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
