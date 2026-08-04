# B2B and Back-office "Mes collaborateurs" page specifications

## Navbar props

- Left : left arrow (back to page-settings)
- middle : "Mes collaborateurs"
- right : none

## Main section

- Section "Mes collaborateurs" props :
  - Title : "Mes collaborateurs"
  - Content : one "Colleague" card per other user of the signed-in user's company
    (b2b) or of the Bike-eco team (back-office), ordered by nom then prénom. The
    signed-in user is never listed — they manage their own account on page-my-account.
  - Message if no entries : "Aucun collaborateur pour le moment."

Each card carries a "Gérer" button **only when the signed-in user is an administrator**;
it opens page-colleague. A non-admin sees the same list without buttons.

## Loading and error states

The section owns its own spinner, mapped French error, and empty message
(component-section).

## Tab bar props

Same as page-settings.
