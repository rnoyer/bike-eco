Layout vertical commun aux steps :

- stepper : disabled Slider
- title : H1 24px bold black
- subtitle : body 14px regular #71727A
- {form fields}
- button secondary : "Précédent"
- button primary : "Suivant" (step 1 and step 2 only) / "S'inscrire" (step 3 only)

---

Form : step 1
slider : 25%
title : "Coordonnées Entreprise"
subtitle : "Indiquez le numéro SIRET de votre entreprise"

---

label : "Numéro SIRET\*"
placeholder : "14 chiffres"
default value : null
type : Input number
mandatory : yes

label : "Nom de votre entreprise\*"
placeholder : "Nom de votre entreprise"
default value : null
type : Input text
mandatory : yes

label : "Département\*"
placeholder : "Département"
default value : null
type : dropdown
values : listes des departements de France métropolitaine (ex: "33 - Gironde", "13 - Bouches du Rhone")
mandatory : yes

label : "Ville\*"
placeholder : "Ville de l'entreprise"
default value : null
type : Input text
mandatory : yes

Texte d'information : "\* Champs obligatoires"

---

Form : step 2
slider : 50%
title : "Votre compte"
subtitle : "Informations relative à votre compte utilisateur"

---

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

label : "Confirmer le mot de passe\*"
placeholder : "Confirmer le mot de passe"
default value : null
type : Input password
mandatory : yes
validation : doit être strictement identique à "Mot de passe" ; sinon le message
"Les mots de passe ne correspondent pas" s'affiche sous ce champ et "Suivant"
ne passe pas au step suivant.

Button : Google authentication

Note : via le bouton Google, l'identité est fournie par Auth — les deux champs
mot de passe ne sont pas saisis et ne bloquent pas le passage au step suivant.

Texte d'information : "\* Champs obligatoires"

---

Form : step 3
slider : 75%
title : "Vos coordonnées"
subtitle : "Informations relative à votre compte utilisateur"

Note : si l'utilisateur s'est authentifié via le bouton Google de l'étape 2,
"Nom" et "Prénom" sont prérempli avec les valeurs du profil Google (l'email
n'est pas concerné, ces champs n'apparaissent pas ici) ; les deux champs
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

Form : step 4
slider : 100%
title : "Demande d'inscription envoyé !"
subtitle : "Votre inscription est prise en compte"
"Un email de confirmation vous sera envoyé lorsque votre compte sera validé par notre équipe."
"Vous pourrez ensuite comencer à utiliser l'application pour vendre vos véhicules."

---
