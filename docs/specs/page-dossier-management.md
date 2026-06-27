# Back-office Dossier management specifications

This page to manage status and store the negociated price.

## Navbar props

- Left : Left arrow icon linked to current page-dossier
- middle : "Statut dossier"
- right : None

## Main section

From top to bottom :

label : "Statut du dossier"
Placeholder : none
default value : "a traiter"
type : dropdown

- "a traiter"
- "en cours"
- "cloturé"

  label : "Prix d’achat négocié"
  placeholder : "€"
  default value : null
  type : Input number
  unit : "€"
  mandatory : no

  Primary Button : "Mettre à jour", update dossier statut and negociated price

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
