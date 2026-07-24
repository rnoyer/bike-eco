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
l'invitation (voir page-add-colleague). Une fois validé, l'email associé est
transmis (avec le code) à l'étape 1 ci-dessous ; un accès direct sans code
valide redirige vers cet écran.

---

Form : step 1
slider : 33%
title : "Votre compte"
subtitle : "Informations relative à votre compte utilisateur"

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

Button : Google authentication

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

Texte d'information : "\* Champs obligatoires"

---

Form : step 3
slider : 100%
title : "Votre inscription est terminée !"

---

Button primary : "Aller à l'accueil"
Linkto : B2B Dashboard
