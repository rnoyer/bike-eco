# B2B and Back-office dossier's Section

Dossier's section holds a title and a list of returned Dossiers.

- If backend does not returns Dossier entries for a section, the section title remain with a message below. The message is slightly different depending on which title section it is :
  - "Vous n'avez pas de dossier à traiter pour le moment."
  - "Vous n'avez pas de dossier en cours pour le moment."
  - "Vous n'avez pas de dossier clos pour le moment."
- There are one fetch for each section
- There is a loading state for each section (spinning loader under the section title, centered and neat)
- If a section's fetch **fails** (offline, permission denied), the section shows the mapped
  French error in place of the list — never the "vous n'avez pas de dossier" message, which
  would tell the user their dossiers don't exist rather than that the read failed.
- On the back office, a section stays in its loading state until the saved "Région gérée"
  has hydrated, so the list is never rendered unfiltered and then re-queried.
- Entries are ordered by submission date
- Implemented as a thin wrapper over the generic [`Section`](component-section.md) component (shared title / loading / error / empty look).
