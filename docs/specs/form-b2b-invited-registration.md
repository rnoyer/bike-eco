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

Button : Google / Apple authentication

Note : chaque champ "Input password" porte à droite une icône œil qui affiche /
masque la saisie. Le mot de passe est masqué par défaut.

Note : via le bouton Google ou Apple, l'identité est fournie par Auth — les deux
champs mot de passe ne sont pas saisis et ne bloquent pas le passage au step
suivant.

Le compte choisi (Google ou Apple) doit être celui de l'invitation. Si
l'utilisateur sélectionne un autre compte, une alerte "Connexion" affiche un
message nommant le fournisseur et les deux adresses, par exemple "Le compte
Apple x@y.fr ne correspond pas à l'invitation envoyée à …. Reprenez avec le bon
compte Apple." — et le formulaire **reste sur ce step** : le step "Vos
coordonnées" n'est pas accessible tant que le bon compte n'a pas été
sélectionné. Le contrôle est répété côté serveur par `acceptInvite`.

Aucun compte parasite ne subsiste dans Firebase Authentication. La comparaison a
lieu **avant** toute création de compte dès que le fournisseur révèle l'adresse
assez tôt pour cela — toujours le cas pour Google natif, et pour Apple quand la
réponse ou le jeton d'identité portent déjà l'email (ce qui n'est garanti qu'à la
toute première autorisation pour cet identifiant Apple ; un jeton ultérieur peut
ou non redonner l'adresse). Dans les autres cas la connexion a déjà eu lieu au
moment où la comparaison devient possible, et elle est défaite : Google web,
ainsi qu'Apple (natif comme web) quand l'adresse n'était pas connue à l'avance,
suppriment le compte qui vient d'être créé, ou déconnectent un compte
préexistant — celui-ci appartient à un vrai utilisateur et n'est jamais
supprimé.

**Cas connu : Apple "Masquer mon adresse email".** Un utilisateur qui choisit
cette option Apple reçoit une adresse `@privaterelay.appleid.com`, qui ne peut
par construction jamais correspondre à l'adresse de l'invitation — le funnel le
refuse donc systématiquement. Le refus est correct, mais le message affiché
("Reprenez avec le bon compte Apple") n'indique pas que la correction consiste à
relancer la fenêtre Apple et à choisir *Partager mon adresse* au lieu de
*Masquer mon adresse email* : contrairement à Google, il n'existe aucun
sélecteur de compte dans l'application pour Apple, l'identifiant Apple étant
défini au niveau de l'appareil et non de l'app. C'est une limitation de copy
connue, pas un bug à corriger dans l'immédiat.

Note : une adresse `@privaterelay.appleid.com` choisie volontairement (et qui
correspond à l'invitation) est acceptée comme n'importe quelle autre adresse. Un
email transactionnel envoyé à une telle adresse ne sera cependant pas distribué
tant que le domaine d'envoi SMTP n'est pas enregistré auprès du service de
relais d'email privé d'Apple.

Texte d'information : "\* Champs obligatoires"

---

Form : step 2
slider : 66%
title : "Vos coordonnées"
subtitle : "Informations relative à votre compte utilisateur"

Note : si l'utilisateur s'est authentifié via le bouton Google ou Apple de
l'étape 1, "Nom" et "Prénom" sont préremplis avec les valeurs fournies par le
fournisseur (l'email reste celui de l'invitation, non modifié par le
fournisseur) ; les deux champs restent modifiables. Apple ne transmet le nom
qu'à la toute première autorisation pour cet identifiant Apple : lors d'une
connexion Apple ultérieure ces deux champs restent vides et l'utilisateur les
saisit lui-même ici, exactement comme dans le parcours mot de passe.

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
