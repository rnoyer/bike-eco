Layout vertical commun aux steps :

- stepper : disabled Slider
- title : H1 24px bold black
- subtitle : body 14px regular #71727A
- {form fields}
- button secondary : "Précédent"
- button primary : "Suivant" (step 1 and step 2 only) / "S'inscrire" (step 3 only)

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

label : "Département\*"
placeholder : "Département"
default value : null
type : dropdown
values : listes des departements de France métropolitaine (ex: "33 - Gironde", "13 - Bouches du Rhone")
mandatory : yes

label : "Ville\*"
placeholder : "Ville"
default value : null
type : Input text
mandatory : yes

Texte d'information : "\* Champs obligatoires"

---

Form : step 3
slider : 100%
title : "Votre inscription est terminée !"

---

Button primary : "Aller à l'accueil"
Linkto : B2B Dashboard
