# B2B and Back-office Dashboard page specifications

## Navbar props

Left : none
middle : "Tableau de bord"
right : none

## Main section

### B2B specificity

From top to Bottom :

- Button : "Vendre une Moto", Link to: b2b-vehicule-submission-form
- Section "Dossiers en cours" props :
  - Title : "Dossiers en cours"
  - List of cards "Dossier" with state "A traiter" or "En cours"
  - Message if no entries : "Vous n'avez pas de dossier en cours pour le moment."
- Section "Dossiers clos" props :
  - Title : "Dossiers en cours"
  - List of cards "Dossier" with state "Cloturé"
  - Message if no entries : "Vous n'avez pas de dossier clos pour le moment."

### Bike-eco Backoffice specificity

From top to Bottom :

- Section "Dossiers à traiter" props :
  - Title : "Dossiers à traiter"
  - List of cards "Dossier" with state "A traiter"
  - Message if no entries : "Vous n'avez pas de dossier à traiter pour le moment."
- Section "Dossiers en cours" props :
  - Title : "Dossiers en cours"
  - List of cards "Dossier" with state "En cours"
  - Message if no entries : "Vous n'avez pas de dossier en cours pour le moment."
- Section "Dossiers clos" props :
  - Title : "Dossiers en cours"
  - List of cards "Dossier" with state "Cloturé"
  - Message if no entries : "Vous n'avez pas de dossier clos pour le moment."

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
