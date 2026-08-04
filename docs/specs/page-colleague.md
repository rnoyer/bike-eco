# "Collaborateur" page specifications

Reached from page-colleagues ("Gérer", administrators only) and, in read-only mode,
from the "Vendeurs de cette entreprise" section of page-company ("Voir détails").

## Navbar props

- Left : left arrow
- middle : "Collaborateur" in management mode; "Détails [Nom] [Prénom]" in the
  back-office read-only mode
- right : none

## Main section

- Section "Information collaborateur" props :
  - A compact list of label/value rows : Nom / Prénom / Email / Téléphone / Rôle
    ("Administrateur", "Vendeur" for a b2b account, "Membre" for a back-office one).

Management mode only :

- Section "Gérer ce collaborateur" props :
  - Primary button : "Ajouter rôle Administrateur" when the colleague is not an
    administrator, "Retirer rôle Administrateur" when they are. The server refuses
    to remove the last administrator of a company (or of the Bike-eco team).
  - Red button : "Supprimer utilisateur", **disabled when the colleague is an
    administrator** (an administrator account cannot be deleted). It opens a
    confirmation modal — "Supprimer cet utilisateur ?" / "Êtes-vous sûr de vouloir
    supprimer l'utilisateur [Nom] [Prénom] ?" / "Annuler" (primary) /
    "Supprimer utilisateur" (red) — and deletes the Firebase Authentication user and
    the `users/{uid}` document. **Dossiers, conversations and stored documents are
    kept**: they carry the submitter's and sender's identity denormalized, and
    Storage is company-prefixed.

## Loading and error states

Centered spinner while the user document is read; the mapped French error on a failed
read; "Utilisateur introuvable." when the document does not exist. While an action runs
every button is locked and the working one shows a spinner; a failure surfaces in an
"Action impossible" dialog.
