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

Below the vehicle-name heading, the data sits under an "Informations" section title
(the shared `Section` component); the body is a compact list of :

- title : field label
- value : field value

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
