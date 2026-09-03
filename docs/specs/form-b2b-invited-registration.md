Layout vertical commun aux steps :

- stepper : disabled Slider
- title : H1 24px bold black
- subtitle : body 14px regular #71727A
- {form fields}
- button secondary : "Précédent"
- button primary : "Suivant" (step 1 and step 2 only) / "S'inscrire" (step 3 only)

---

Écran préalable (hors stepper) : "Code d'invitation"

Accessible depuis page-login-signup via le lien "J'ai un code d'invitation".

label : "Code d'invitation\*"
placeholder : "Code à 6 caractères"
default value : null
type : Input text (6 caractères, en majuscules)
mandatory : yes

Le code est un code à usage unique valable 1 heure, envoyé par email lors de
l'invitation (voir page-add-colleague). Une invitation porte le rôle qu'elle
accorde : un invité rejoint soit une entreprise (b2b), soit l'équipe Bike-eco
(back-office). L'écran de saisie du code est antérieur à sa résolution, donc son
sous-titre reste neutre : "Saisissez le code à 6 caractères reçu par email pour
rejoindre votre équipe." Une fois validé, l'email associé est
transmis (avec le code) à l'étape 1 ci-dessous ; un accès direct sans code
valide redirige vers cet écran.

---

Form : step 1
slider : 33%
title : "Votre compte"
subtitle : "Vous rejoignez [nom de l'entreprise ou Bike-eco]." — le nom vient de la
résolution du code ; à défaut, "Informations relative à votre compte utilisateur"

---

label : "Adresse email\*"
placeholder : none
value : prefilled with email invitation link
status : disabled
type : Input email
mandatory : yes

label : "Mot de passe\*"
placeholder : "Mot de passe"
default value : null
type : Input password
mandatory : yes

label : "Confirmer le mot de passe\*"
placeholder : "Confirmer le mot de passe"
default value : null
type : Input password
mandatory : yes
validation : doit être strictement identique à "Mot de passe" ; sinon le message
"Les mots de passe ne correspondent pas" s'affiche sous ce champ et "Suivant"
ne passe pas au step suivant.

Button : Google authentication

Note : chaque champ "Input password" porte à droite une icône œil qui affiche /
masque la saisie. Le mot de passe est masqué par défaut.

Note : via le bouton Google, l'identité est fournie par Auth — les deux champs
mot de passe ne sont pas saisis et ne bloquent pas le passage au step suivant.

Le compte Google choisi doit être celui de l'invitation. Si l'utilisateur
sélectionne un autre compte dans le sélecteur Google, une alerte "Connexion
Google" nomme les deux adresses (celle choisie et celle de l'invitation), et le
formulaire **reste sur ce step** — le step "Vos coordonnées" n'est pas accessible
tant que le bon compte n'a pas été sélectionné. Le contrôle est répété côté
serveur par `acceptInvite`.

Aucun compte parasite ne subsiste dans Firebase Authentication, par deux
mécanismes selon la plateforme :

- **natif** : le SDK Google renvoie l'adresse avant que Firebase ne voie le
  credential, donc la comparaison a lieu **avant** toute création de compte —
  aucun compte n'est enregistré ;
- **web** : le popup authentifie avant que la comparaison soit possible ; le
  compte qui vient d'être créé est donc supprimé immédiatement (un compte
  préexistant, lui, est seulement déconnecté — il appartient à un vrai
  utilisateur).

Texte d'information : "\* Champs obligatoires"

---

Form : step 2
slider : 66%
title : "Vos coordonnées"
subtitle : "Informations relative à votre compte utilisateur"

Note : si l'utilisateur s'est authentifié via le bouton Google de l'étape 1,
"Nom" et "Prénom" sont prérempli avec les valeurs du profil Google (l'email
reste celui de l'invitation, non modifié par Google) ; les deux champs
restent modifiables.

---

label : "Nom\*"
placeholder : "Votre nom"
default value : null
type : Input text
mandatory : yes

label : "Prénom\*"
placeholder : "Votre prénom"
default value : null
type : Input text
mandatory : yes

label : "Téléphone\*"
placeholder : "Votre numéro de téléphone"
default value : null
type : Input phone number
validation : 10 digits
mandatory : yes

---

label : "Région gérée"
placeholder : "Toute la France"
default value : null
type : dropdown — "Moitié Nord" / "Moitié sud" / "Toute la France"
mandatory : no
visible : invitation back-office uniquement (le rôle vient de la résolution du
code) ; un invité b2b n'a pas de région, le champ est absent — et `acceptInvite`
refuse de l'enregistrer pour lui même si la requête en porte une.

Ce champ écrit `users/{uid}.notificationRegion` : il filtre le dashboard
back-office **et** cadre les notifications push (voir
[`feature-push-notifications.md`](feature-push-notifications.md)). Ne rien
choisir vaut exactement l'option "Toute la France" (`null`) — d'où le
placeholder. Le membre peut le changer ensuite dans Paramètres → "Région gérée"
(voir [`page-settings.md`](page-settings.md)).

Texte d'information : "\* Champs obligatoires"

Mention légale (fin du formulaire, juste au-dessus des boutons Précédent /
S'inscrire) : "En cliquant sur S'inscrire, vous acceptez les Conditions
d'utilisation et la Politique de confidentialité de Bike-eco."

"Conditions d'utilisation" et "Politique de confidentialité" sont des liens vers
les documents publiés sur le site (URLs dans `src/constants/legal.ts` —
**provisoires**, à remplacer quand les pages seront en ligne). Rendue par
`LegalNotice`, passée au `footer` de `FormLayout` sur la dernière étape
uniquement.

---

Form : step 3
slider : 100%
title : "Votre inscription est terminée !"

Un invité back-office suit le même parcours (compte, coordonnées — plus le champ
optionnel "Région gérée" —, confirmation) et son compte est actif immédiatement — il n'y a pas d'étape de
validation, comme pour un invité b2b. Il n'est pas administrateur.

---

Button primary : "Aller à l'accueil"
Linkto : B2B Dashboard pour un invité b2b, Back-office Dashboard pour un invité
back-office (selon le rôle porté par l'invitation).
