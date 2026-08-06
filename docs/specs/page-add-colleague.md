# B2B and Back-office "Add colleague" page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Inviter un collègue"
- right : None

## Main section

Cette page sert les deux rôles. Un b2b invite un collaborateur de son entreprise ;
un back-office invite un membre de l'équipe Bike-eco. Elle n'est atteignable que
par un administrateur (le bouton "Inviter" de page-settings est masqué pour les
autres) et le serveur refuse l'appel d'un non-administrateur.

From top top bottom

- One forme field :
  - label : "Adresse email de l'invité\*"
  - placeholder : "Email"
  - default value : null
  - type : Input email
  - mandatory : yes
- Button primary :
  - text : "Envoyer l'invitation"
  - trigger send invitation : génère un code à usage unique, valable 1 heure,
    et l'envoie par email à l'adresse saisie (voir
    form-b2b-invited-registration pour l'écran de saisie du code côté
    invité).
  - link to page-confirmation
    - message : l'invitation à bien été envoyée.
    - Redirect to page-Dashboard (celui du rôle : b2b ou back-office)

## Tab bar props

none
