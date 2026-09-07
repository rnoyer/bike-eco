# B2B and Back-office login/signup front page specifications

A card holding all of the content below.
From top to bottom

- Title : "Bienvenue !"

-sign in form :
label : "Adresse email\*"
placeholder : "Votre email"
default value : null
type : Input email
mandatory : yes

label : "Mot de passe\*"
placeholder : "Mot de passe"
default value : null
type : Input password
mandatory : yes

Note : tout champ "Input password" porte à droite une icône œil qui affiche /
masque la saisie. Le mot de passe est masqué par défaut.

- Link : "Mot de passe oublié"

  Envoie l'email de réinitialisation Firebase à l'adresse saisie dans le champ
  email. Champ vide → "Saisissez votre email pour réinitialiser le mot de passe."
  Sinon la même confirmation s'affiche que l'adresse ait un compte ou non (on ne
  révèle jamais l'existence d'un compte) : "Si un compte existe pour cet email, un
  lien de réinitialisation vient d'être envoyé. Vérifiez votre boîte de réception."
  Le lien est désactivé pendant l'envoi.

- Button primary : "Login"
- Divider
- Text : "Ou continuez avec"
- Three Buttons for third party auth : Google, Apple, Facebook

  Google (toutes plateformes) et Apple (iOS et web uniquement — aucun bouton Apple
  sur Android) sont les fournisseurs actifs ; Facebook reste désactivé. Sur iOS le
  bouton Apple est le bouton système d'Apple ("Continuer avec Apple") ; sur web
  c'est le bouton outlined qui reprend le style de la rangée, avec le même titre
  approuvé par Apple.

  La connexion, quel que soit le fournisseur, est réservée aux comptes déjà
  inscrits : si l'identité (Google ou Apple) n'a pas de document `users/{uid}`,
  elle n'a jamais suivi le funnel — le message "Aucun compte Bike-eco n’est
  associé à ce compte Google. Créez un compte pour continuer." ou "… à ce compte
  Apple. Créez un compte pour continuer." s'affiche sous le formulaire, selon le
  fournisseur choisi. Le compte Firebase Authentication que cette tentative vient
  de créer est supprimé (aucun compte parasite ne subsiste) ; un compte
  préexistant est seulement déconnecté. Un abandon de la fenêtre Apple affiche
  "Connexion Apple annulée." Les boutons sont désactivés ensemble pendant
  l'aller-retour, quel que soit celui qui l'a déclenché.

  La connexion Apple suppose en plus que le fournisseur Apple soit activé dans la
  console Firebase et, pour le popup web spécifiquement, qu'un Apple Services ID
  portant l'URL de retour Firebase soit configuré. Tant que ce n'est pas fait, iOS
  reçoit `auth/operation-not-allowed` et le popup web échoue.

- Link : "Pas encore de compte ? Créer un compte" → form-b2b-company-registration
- Link : "J'ai un code d'invitation" → écran de saisie du code d'invitation
  (voir form-b2b-invited-registration)
