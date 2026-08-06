# B2B and Back-office dossier's Card specifications

The card is thin as it is supposed to be stacked under each section. its width is wide. Each card represent a Dossier.

Dossier's Card props :

- image : On the left side, a thumbnail of the first photo uploaded. This thumbnail is low-res generated image of the uploaded one. While it loads, and for a dossier with no photo at all, the placeholder is `brandTint` — a grey square read as a hole in the card.
- title : Relevant information to identify Dossier
- subtitle : Additionnal information to identify Dossier. Optional — when absent,
  no subtitle line is rendered. On the B2B dashboard it shows
  "Prix négocié : [X] €" only once the back-office has set a negotiated price.
