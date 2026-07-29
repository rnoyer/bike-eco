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
  - "Envoyer" is greyed out and inert while there is neither text nor an attachment.
  - The "+" icon shows a spinner while a picker is opening — the permission
    prompt and, for a large PDF, the copy-to-cache pass are both slow enough to
    look like a dead tap.

While the thread is loading, the page shows a centered spinner — never a blank
view, which would be indistinguishable from an empty conversation. If the read
fails, it shows the mapped French error instead.

## Sending

Sends go through the `sendMessage` Cloud callable: the client uploads any
attachments then calls it with the message text and attachment metadata. The
sender label ("[prénom nom] - [société]" or "[prénom nom] - Bike-eco") is
stamped server-side from the caller's own identity — it is never
client-authored, so it can't be forged.

**Sending is optimistic.** The composer clears the moment the user taps
"Envoyer", and the message appears immediately at the bottom of the thread as
its own bubble carrying the text and the attachment previews:

- **While sending** — the bubble is greyed, with a small spinner and "Envoi…"
  in place of the timestamp. Its attachments are shown but not tappable: they
  are still local files.
- **On failure** — the bubble returns to full strength and shows the mapped
  French error with two actions, **Réessayer** and **Supprimer**. Nothing the
  user typed or attached is lost; it lives in the bubble until the send
  succeeds or they explicitly discard it.
- **On success** — the bubble is replaced by the real message once it arrives in
  the live thread. Retrying re-sends under the same message id, so a message can
  never be duplicated by retrying, and a send whose response was lost resolves
  itself when the document appears.

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
