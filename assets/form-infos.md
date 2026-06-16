Layout vertical commun aux steps 1 à 8 : 
- stepper : disabled Slider
- title : H1 24px bold black
- subtitle : body 14px regular #71727A
- {forms inputs}
- button : "Précédent"
- button : "Suivant"

---------------------------------
Form : step 1
slider : 10%
title : "Vos coordonnées"
---------------------------------

label : "Nom"
placeholder : "Votre nom"
default value : null
type : Input text
mandatory : yes

label : "Prénom"
placeholder : "Votre prénom"
default value : null
type : Input text
mandatory : yes

label : "Adresse email"
placeholder : "Votre email"
default value : null
type : Input email
mandatory : yes

label : "Téléphone"
placeholder : "Votre numéro de téléphone"
default value : null
type : Input phone number
validation : 10 digits
mandatory : yes

label : "Département"
placeholder : "Département"
default value : null
type : dropdown
values : listes des departements de France métropolitaine (ex: "33 - Gironde", "13 - Bouches du Rhone")
mandatory : yes

label : "Ville"
placeholder : "Ville"
default value : null
type : Input text
mandatory : yes

---------------------------------
Form : step 2
slider : 20%
title : "Informations vehicule"
subtitle : "Quelle est votre moto?"
---------------------------------

label : "Marque"
placeholder : "Marque du véhicule"
default value : null
type : Input text
mandatory : no

label : "Modèle"
placeholder : "Modèle du véhicule"
default value : null
type : Input text
mandatory : no

label : "Cylindrée"
placeholder : "Cylindrée du véhicule en CC"
default value : null
type : Input number
unit : "cc"
mandatory : no

label : "Année"
placeholder : "Année de mise en service"
default value : null
type : Input year
mandatory : no

label : "Kilométrage"
placeholder : "Kilométrage du véhicule"
default value : null
type : Input number
unit : "km"
mandatory : no

label : "Accessoires"
placeholder : "Listez ici les éventuels accessoires"
default value : null
type : Input text long
mandatory : no

---------------------------------
Form : step 3
slider : 30%
title : "Informations vehicule"
subtitle : "Quelles clés et télécommandes avez-vous?"
---------------------------------

label : "Clé noire"
Placeholder : none
default value : null
type : dropdown 
- 0
- 1
- 2
- 3
- 4
mandatory : no

label : "Clé marron"
Placeholder : none
default value : null
type : dropdown 
- 0
- 1
- 2
- 3
- 4
mandatory : no

label : "Clé rouge"
Placeholder : none
default value : null
type : dropdown 
- 0
- 1
- 2
- 3
- 4
mandatory : no

label : "Télécommande"
Placeholder : none
default value : null
type : dropdown 
- 0
- 1
- 2
- 3
- 4
mandatory : no

---------------------------------
Form : step 4
slider : 40%
title : "Informations vehicule"
subtitle : "Précisions concernant l'état du véhicule"
---------------------------------

label : "Dans quel état se trouve votre moto ?"
placeholder : "Etat du véhicule"
default value : null
type : dropdown
- "En Panne"
- "Accidenté"
- "Fort kilométrage"
- "Refus au Contrôle Technique"
- "Mauvais Etat"
mandatory : no

condition : Si "En Panne" selectionné
label : "Connaissez-vous la panne?"
placeholder : "Nature de la panne"
default value : null
type : Input text
mandatory : no

---------------------------------
Form : step 5
slider : 50%
title : "Informations vehicule"
subtitle : "Quelles papiers du vehicules sont en votre possession?"
---------------------------------

label : "Carnet d’entretien"
Placeholder : none
default value : null
type : dropdown
- "oui"
- "non"
mandatory : no

label : "Facture d’entretien"
Placeholder : none
default value : null
type : dropdown
- "oui"
- "non"
mandatory : no

label : "Avez-vous le Controle Technique?"
Placeholder : none
default value : null
type : dropdown
- "oui"
- "non"
mandatory : no

condition : Si "oui" selectionné pour "Avez-vous le Controle Technique?"
label : "Contrôle technique de moins de 6 mois?"
Placeholder : none
default value : null
type : dropdown
- "oui"
- "non"
mandatory : no

label : "Avez-vous la carte grise du vehicule?"
Placeholder : none
default value : null
type : dropdown
- "oui"
- "non"
mandatory : no

label : "Est-elle a votre nom?"
Placeholder : none
default value : null
type : dropdown
- "oui"
- "non"
mandatory : no

---------------------------------
Form : step 6
slider : 60%
title : "Photos du véhicule"
subtitle : "Ajoutez au moins 3 photos récentes"
---------------------------------

- bouton "Gallerie" : ouvre la gallerie de photo
- bouton "Appareil Photo" : ouvre l'appareil photo
- caroussel des photos ajoutées
  - horizontal slider
  - croix sur chaque photo pour la supprimer (avec popup de confirmation "voulez-vous supprimer cette photo?")
mandatory : 3 photos
---------------------------------
Form : step 7
slider : 70%
title : "Prix souhaité"
subtitle : "Indiquez le prix souhaité, en euros"
---------------------------------

label : "Prix souhaité"
placeholder : "€"
default value : null
type : Input number
unit : "€"
mandatory : no


label : "Commentaires"
placeholder : "Informations complémentaires"
default value : null
type : Input text long
mandatory : no

---------------------------------
Form : step 8
slider : 80%
title : "Modalités de reprise du véhicule"
subtitle : "Vous pouvez nous déposer le véhicule, ou demander l'enlèvement 100% gratuit"
---------------------------------

label : "Comment souhaitez-vous faire la reprise du véhicule?"
Placeholder : none
default value : null
type : dropdown
- "Enlevement a domicile"
Si le département sélectionné fait partie du 'Nord'
- "Je dépose la moto au centre de Montargis"
Si le département sélectionné fait partie du 'Sud'
- "Je dépose la moto au centre de Vitrolles"
mandatory : no

---------------------------------
Form : step 9
slider : 100%
title : "Demande envoyé !"
subtitle : "Un email récapitulatif va vous parvenir." "Vous serez recontacté très prochainement par notre équipe."
---------------------------------
