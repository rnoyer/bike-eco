# Back-office company page specifications

## Navbar props

- Left : Left arrow icon linked to page-list-company
- middle : "Vendeur"
- right : None

## Main section

From top to Bottom, scrollable view with :

Only If registration is pending :

- Section "Voulez-vous autoriser cette entreprise à vendre des vehicules" props :
  - Two buttons side by side : 'Autoriser' (validate company), 'Décliner inscription' (discard company, delete everything about this company)
  - Both *Décliner inscription* and *Supprimer cette entreprise* call the same server `deleteCompany` cascade (hard-delete: users + dossiers + chats + stored documents). *Décliner* is the pending-state entry point; *Supprimer* the active-state one.

- Section "Information vendeur" props :
  - All forms information related to the company : A compact list of title>field label and value>field value

- Section "Information vendeur admin" props :
  - The registering user's personal info only (Nom / Prénom / Email / Téléphone) : A compact list of
    title>field label and value>field value. The company's location (Département / Ville) lives in
    "Information vendeur" above, not here.

- Only If registration is approved :
  - Section "Autres utilisateurs de cette entreprise" props :
    - List of approved users

  - Section "Gérer cette entreprise" props :
    - One red button : 'Supprimer cette entreprise' (delete company + related users + related Dossiers, related chat + all stored documents) (before deletion a confirmation modal opens to warn about what is deleted, and two buttons : primary button : 'Annuler', secondary button : 'Supprimer tout')

## Loading and error states

While the company and its users are being read the page shows a centered
spinner. If either read fails it shows the mapped French error; if the company
does not exist, "Entreprise introuvable.".

While an action is running, every button on the page is locked and the button
that is actually working shows a spinner in place of its label — the others
simply dim. A failure surfaces the mapped French message in an
"Action impossible" dialog and the page stays put.
