Layout vertical commun aux steps 1 à 10 :

- stepper : disabled Slider
- title : H1 24px bold black
- subtitle : body 14px regular #71727A
- {form fields}
- button secondary : "Précédent"
- button primary : "Suivant"

---

Form : step 1
slider : 0%
title : "Vos coordonnées"

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

label : "Adresse email\*"
placeholder : "Votre email"
default value : null
type : Input email
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

Form : step 2
slider : 10%
title : "Informations vehicule"
subtitle : "Quelle est votre moto?"

---

label : "Numéro d'immatriculation"
placeholder : "AA-123-AA"
default value : null
type : Input text short, up to 15 characters
mandatory : no

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

Form : step 3
slider : 20%
title : "Informations vehicule"
subtitle : "Quelle est votre moto?"

---

label : "Marque"
placeholder : "Marque du véhicule"
default value : null
type : Input text
mandatory : no if "Modèle" is filled

label : "Modèle"
placeholder : "Modèle du véhicule"
default value : null
type : Input text
mandatory : no if "Marque" is filled

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

---

Form : step 4
slider : 30%
title : "Informations vehicule"
subtitle : "Quelles clés avez-vous?"

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

label : "Avez-vous une clé main libre (keyless) ?"
Placeholder : none
default value : null
type : dropdown

- "oui"
- "non"
  mandatory : no

condition : If "Avez-vous une clé main libre (keyless) ?" === "oui"
label : "Clé main libre (keyless)"
default value : unchecked
type : checkboxes

- "Code"
- "Clé de secours"
  mandatory : no

---

Form : step 5
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

Form : step 6
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
- galerie des photos ajoutées
  - vignettes carrées en grille, 3 par ligne, autant de lignes que nécessaire
    (la page défile avec le formulaire)
  - croix sur chaque photo pour la supprimer (avec popup de confirmation "voulez-vous supprimer cette photo?")
    mandatory : 1 photo
    maximum : 10 photos — les deux boutons sont désactivés une fois la limite atteinte,
    et la sélection multiple de la galerie est plafonnée au nombre de places restantes.
- Mention d'information (bas de l'étape, sous la galerie, juste au-dessus des
  boutons Précédent / Suivant) : "Vos photos servent uniquement à estimer le
  véhicule. Évitez d'y faire apparaître des personnes ou des documents
  personnels." — rendue par `PhotosFields`, donc partagée par les deux funnels.

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

Form : step 9
slider : 80%
title : "Modalités de reprise du véhicule"
subtitle : "Vous pouvez nous déposer le véhicule, ou demander l'enlèvement."

---

label : "Comment souhaitez-vous faire la reprise du véhicule?"
Placeholder : none
default value : null
type : dropdown

- "Enlevement a domicile"
  If "département" (step 1) isNord
- "Je dépose la moto au centre de Montargis"
  If "département" (step 1) isSud
- "Je dépose la moto au centre de Vitrolles"
  mandatory : no

Mention légale (fin du formulaire, juste au-dessus des boutons Précédent /
Envoyer) : "En cliquant sur Envoyer, vous acceptez les Conditions
d'utilisation, la Politique de confidentialité et la Politique relative aux
cookies de Bike-eco."

"Conditions d'utilisation" et "Politique de confidentialité" sont des liens vers
les documents publiés sur le site (URLs dans `src/constants/legal.ts` —
**provisoires**, à remplacer quand les pages seront en ligne). Rendue par
`LegalNotice`, passée au `footer` de `FormLayout` sur la dernière étape
uniquement.

---

Form : step 10
slider : 100%
title : "Demande envoyé !"
subtitle : "Un email récapitulatif va vous parvenir." "Vous serez recontacté très prochainement par notre équipe."

---

---

## Règles communes

**Longueurs maximales** — appliquées trois fois pour la même valeur : `maxLength` sur
l'input, `.max()` dans le schéma Zod du funnel, et — pour le funnel B2C, dont l'endpoint
est public et non authentifié — dans `functions/src/payload.ts`. Les constantes vivent
dans `src/constants/vehicle.ts` (`SHORT_TEXT_MAX`, `FREE_TEXT_MAX`, `NUMBER_TEXT_MAX`,
`IMMATRICULATION_MAX`) et sont recopiées côté functions, qui compile isolément.

| Type de champ | Max |
|---|---|
| Input text (marque, modèle, ville, nom, nature de la panne…) | 120 caractères |
| Input text long (accessoires, commentaires) | 2000 caractères |
| Input number (kilométrage, prix, cylindrée) | 9 chiffres |
| Année | 4 chiffres |
| Numéro d'immatriculation | 15 caractères |

**Cases à cocher conditionnelles** — les groupes de cases révélés par une réponse "oui"
(le matériel électrique, la clé main libre) **gardent** ce qui a été coché si l'utilisateur
repasse la question parente à "non" : un basculement accidentel ne doit pas effacer sa
saisie, et revenir à "oui" la restitue. En revanche le contenu est vidé **au parsing**
(`clearUnaskedCheckboxes`), donc rien de coché ne peut sortir du formulaire sous une
réponse "non" — ni vers Firestore, ni vers les emails.
