# B2B and Back-office Chat page specifications

## Navbar props

- Left : Left arrow icon linked to current page-dossier
- middle : "Messages"
- right : None

## Main section

From top to bottom

- scrollable view with all the messages and their attachments. Attachments are
  interactive:
  - **photos** render as a tappable thumbnail; tapping opens **that photo** full
    screen with pinch / double-tap zoom and a "✕" to close. One photo at a time —
    there is no swiping between photos.
  - **PDFs** render as a tappable row: the `pdfIcon.svg` asset next to the file's
    name, truncated with an ellipsis ("…") when it is too long for the bubble.
    Tapping opens the file in the device's default PDF reader. If no handler can
    open it, an alert says "Impossible d'ouvrir le PDF."
- an input section for entering chat message. Left to the input section a "+" icon to add only pdf or photos from phone

Sends go through the `sendMessage` Cloud callable: the client uploads any
attachments then calls it with the message text and attachment metadata. The
sender label ("[prénom nom] - [société]" or "[prénom nom] - Bike-eco") is
stamped server-side from the caller's own identity — it is never
client-authored, so it can't be forged.

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
