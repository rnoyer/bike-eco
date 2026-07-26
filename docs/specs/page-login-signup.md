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

  Google est le seul fournisseur actif (Apple et Facebook sont désactivés). La
  connexion Google est réservée aux comptes déjà inscrits : si l'identité Google
  n'a pas de document `users/{uid}`, elle n'a jamais suivi le funnel — le message
  "Aucun compte Bike-eco n'est associé à ce compte Google. Créez un compte pour
  continuer." s'affiche sous le formulaire. Le compte Firebase Authentication que
  cette tentative vient de créer est supprimé (aucun compte parasite ne subsiste) ;
  un compte préexistant est seulement déconnecté. Les boutons sont désactivés
  pendant l'aller-retour.

- Link : "Pas encore de compte ? Créer un compte" → form-b2b-company-registration
- Link : "J'ai un code d'invitation" → écran de saisie du code d'invitation
  (voir form-b2b-invited-registration)
