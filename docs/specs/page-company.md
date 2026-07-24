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
  - All forms information related to the registering user : A compact list of title>field label and value>field value

- Only If registration is approved :
  - Section "Autres utilisateurs de cette entreprise" props :
    - List of approved users

  - Section "Gérer cette entreprise" props :
    - One red button : 'Supprimer cette entreprise' (delete company + related users + related Dossiers, related chat + all stored documents) (before deletion a confirmation modal opens to warn about what is deleted, and two buttons : primary button : 'Annuler', secondary button : 'Supprimer tout')
