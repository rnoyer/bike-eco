# B2B and Back-office dossier's Section

Dossier's section holds a title and a list of returned Dossiers.

- If backend does not returns Dossier entries for a section, the section title remain with a message below. The message is slightly different depending on which title section it is :
  - "Vous n'avez pas de dossier à traiter pour le moment."
  - "Vous n'avez pas de dossier en cours pour le moment."
  - "Vous n'avez pas de dossier clos pour le moment."
- There are one fetch for each section
- There is a loading state for each section (spinning loader under the section title, centered and neat)
- Entries are ordered by submission date
