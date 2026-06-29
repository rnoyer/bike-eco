# B2B and Back-office Settings page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Paramètres"
- right : None

## Main section

From top to bottom

### B2B

- Button secondary : Inviter un collègue
- Supprimer son compte

### Bike-eco Backoffice

label : "Territoire géré"
Placeholder : none
default value : "Toute la France"
type : dropdown

- "Moitié Nord" (maps to region `NORTH`)
- "Moitié sud" (maps to region `SOUTH`)
- "Toute la France" (no region filter)

behaviour : filters the dossiers shown on the back-office dashboard by region. The chosen
option is persisted locally and restored when the app is restarted.

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
