Layout vertical commun aux steps 1 à 10 :

- stepper : disabled Slider
- title : H1 24px bold black
- subtitle : body 14px regular #71727A
- {form fields}
- button secondary : "Précédent"
- button primary : "Suivant"

---

Form : step 1
slider : 10%
title : "Informations vehicule"
subtitle : "Quelle est votre moto?"

---

label : "S'agit-il d'un véhicule électrique?"
Placeholder : none
default value : non
type : dropdown

- "oui"
- "non"
  mandatory : yes

condition : If "S'agit-il d'un véhicule électrique?" === "oui"
label : "Cochez le materiel en votre possession"
default value : unchecked
type : checkboxes

- "J'ai la batterie"
- "J'ai le chargeur"

---

Form : step 2
slider : 20%
title : "Informations vehicule"
subtitle : "Quelle est votre moto?"

---

label : "Marque"
placeholder : "Marque du véhicule"
default value : null
type : Input text
mandatory : no if "Modèle" is filled

label : "Modèle et Cylindrée"
placeholder : "Modèle du véhicule"
default value : null
type : Input text
mandatory : no if "Marque" is filled

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

label : "Commentaires"
placeholder : "Ex. Etat de la moto"
default value : null
type : Input text long
mandatory : no

---

Form : step 3
slider : 30%
title : "Informations vehicule"
subtitle : "Quelles clés et télécommandes avez-vous?"

---

label : "Avez-vous des clés de contact"
Placeholder : none
default value : null
type : dropdown

- "oui"
- "non"
  mandatory : no

condition : If "Avez-vous des clés de contact" === "oui"
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

condition : If "Avez-vous des clés de contact" === "oui"
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

condition : If "Avez-vous des clés de contact" === "oui"
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

label : "Avez-vous une télécommande ou un Bip de démarrage?"
Placeholder : none
default value : null
type : dropdown

- "oui"
- "non"
  mandatory : no

condition : If "Avez-vous des clés de contact" === "oui"
label : "Télécommande / Bip de démarrage"
Placeholder : none
default value : null
type : dropdown

- 0
- 1
- 2
- 3
- 4
  mandatory : no

---

Form : step 4
slider : 40%
title : "Informations vehicule"
subtitle : "Précisions concernant l'état du véhicule"

---

label : "Dans quel état se trouve votre moto ?"
placeholder : "Etat du véhicule"
default value : null
type : dropdown

- "Bon état"
- "En Panne"
- "Fort kilométrage"
- "Refus au Contrôle Technique"
- "Mauvais Etat"
- "Accidenté"
  mandatory : no

condition : Si "En Panne" selectionné
label : "Connaissez-vous la panne?"
placeholder : "Nature de la panne"
default value : null
type : Input text
mandatory : no

---

Form : step 5
slider : 50%
title : "Informations vehicule"
subtitle : "Quelles papiers du vehicules sont en votre possession?"

---

label : "Avez-vous la carte grise du vehicule?"
Placeholder : none
default value : null
type : dropdown

- "oui"
- "non"
  mandatory : no

condition : If "Avez-vous la carte grise du vehicule?" === "oui"
label : "La carte grise est-elle a votre nom?"
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

condition : If "Avez-vous le Controle Technique?" === "oui"
label : "Contrôle technique de moins de 6 mois?"
Placeholder : none
default value : null
type : dropdown

- "oui"
- "non"
  mandatory : no

condition : If "Avez-vous le Controle Technique?" === "oui"
label : "Résultat obtenu?"
Placeholder : none
default value : null
type : dropdown

- "Favorable"
- "Défavorable"
  mandatory : no

label : "Avez-vous le certificat de non-gage?"
Placeholder : none
default value : null
type : dropdown

- "oui"
- "non"
  mandatory : no
  underlined message : [Lien vers le formulaire de demande de certificat](https://siv.interieur.gouv.fr/map-usg-ui/do/accueil_certificat)

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

---

Form : step 7
slider : 60%
title : "Photos du véhicule"
subtitle : "Ajoutez au moins 1 photo récente"

---

- Message de préconisation : Ajoutez des photos de bonne qualité, montrant plusieurs faces de la moto.
- bouton "Gallerie" : ouvre la gallerie de photo
- bouton "Appareil Photo" : ouvre l'appareil photo
- caroussel des photos ajoutées
  - horizontal slider
  - croix sur chaque photo pour la supprimer (avec popup de confirmation "voulez-vous supprimer cette photo?")
    mandatory : 1 photo

---

Form : step 8
slider : 70%
title : "Prix souhaité"
subtitle : "Indiquez le prix souhaité, en euros"

---

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

---

Form : step 10
slider : 100%
title : "Demande envoyé !"
subtitle : "Un email récapitulatif va vous parvenir." "Vous serez recontacté très prochainement par notre équipe."

---
