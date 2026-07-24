# B2B and Back-office "Add colleague" page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Inviter un collègue"
- right : None

## Main section

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
    - Redirect to page-Dashboard

## Tab bar props

none
