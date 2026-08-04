# B2B and Back-office Settings page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Paramètres"
- right : None

## Main section

From top to bottom

### B2B

- Button secondary : Inviter un collègue
- Section "Mes collaborateurs" :
  - Button secondary : "Voir mes collaborateurs" (link to page-colleagues)
- "Supprimer son compte" lives on page-my-account, not here.

### Bike-eco Backoffice

- Button secondary : "Gérer les entreprises" (link to page-list-companies)
- Section "Mes collaborateurs" :
  - Button secondary : "Voir mes collaborateurs" (link to page-colleagues)

label : "Région gérée"
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
