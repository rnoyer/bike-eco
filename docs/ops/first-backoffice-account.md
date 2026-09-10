# Créer un compte back-office sur le projet live

Procédure à faire soi-même, ~5 minutes, sur `bike-eco-43a84`. Nécessaire au moins une fois :
`sendInvite` peut créer un compte back-office, mais seul un administrateur actif peut l'appeler,
donc le tout premier admin est amorcé hors application. Les suivants s'invitent depuis
l'application — voir [Comptes back-office suivants](#comptes-back-office-suivants) plus bas.

Tout se passe dans le navigateur, via **Cloud Shell** : les identifiants utilisés sont ceux de
votre propre compte Google, il n'y a rien à installer et **aucune clé de compte de service** à
télécharger. Ne créez jamais de clé JSON pour cette opération.

## Ce que fait le script

Une session valide repose sur **trois** écritures serveur — les deux dernières contournent les
règles de sécurité, `users` étant en `allow create: if false` côté client :

| # | Objet | Pourquoi |
| - | ----- | -------- |
| 1 | l'utilisateur Auth | l'identité elle-même |
| 2 | les custom claims `role` / `companyId` / `status` | source de vérité des droits (`src/lib/auth/session.ts`, `firestore.rules` → `isBackoffice()`) |
| 3 | le document `users/{uid}` dans **`bike-eco-db`** | sans lui `AuthProvider` laisse la session à `null` et le guard renvoie vers l'écran de connexion |

`scripts/grant-backoffice.js` fait les trois. Il est **idempotent** : le relancer répare ce qui
manque (compte existant réutilisé, claims reposées, profil complété).

## 1. Ouvrir Cloud Shell

[console.cloud.google.com](https://console.cloud.google.com/) → vérifier que le projet
sélectionné est **bike-eco-43a84** → icône **Cloud Shell** (`>_`) en haut à droite.

## 2. Déposer le script

```bash
cloudshell edit grant-backoffice.js
```

L'éditeur s'ouvre sur un fichier vide : y coller le contenu de `scripts/grant-backoffice.js`
(depuis ce dépôt), puis sauvegarder.

## 3. Lancer

```bash
npm i firebase-admin

node grant-backoffice.js \
  --email  admin@bike-eco.fr \
  --prenom Alex \
  --nom    Martin \
  --tel    0605060708
```

`--password` est optionnel : sans lui le script génère un mot de passe aléatoire et l'affiche —
il n'est que temporaire, l'étape 4 le remplace.

`--region north|south|all` est optionnel : il pose la **région gérée**
(`users/{uid}.notificationRegion`), qui filtre le dashboard back-office **et** cadre les
notifications push (voir `docs/specs/feature-push-notifications.md`). `all` = "Toute la
France" (`null`), ce qui est aussi le comportement quand le champ n'a jamais été posé.

Il est volontairement **absent de la commande ci-dessus**, qui sert aussi de commande de
réparation ([Dépannage](#dépannage)) : sans le drapeau le script ne touche pas au champ,
donc une réparation n'efface pas un choix fait entre-temps depuis Paramètres → "Région
gérée". Ne l'ajouter que pour poser (ou corriger) délibérément la région ; le titulaire
peut de toute façon la changer lui-même depuis cet écran.

Le compte créé est **administrateur** (`isAdmin: true`) par défaut — c'est l'équipe
fondatrice, et seul un administrateur peut gérer (ou supprimer) les membres de l'équipe
depuis « Mes collaborateurs ». `--no-admin true` crée à la place un simple membre.

Le script affiche l'UID créé. En cas d'erreur, voir [Dépannage](#dépannage).

## 4. Passer la main au titulaire du compte

Console Firebase → **Authentication → Users** → menu de la ligne → **Reset password**. Le mot de
passe final n'est ainsi connu que du titulaire.

## 5. Connexion Google (optionnel)

Pour que le même compte puisse aussi se connecter avec Google, vérifier une fois dans
**Authentication → Settings → User account linking** que l'option **« Link accounts that use the
same email »** est active : la credential Google se rattache alors au **même UID**, donc les
claims et le profil restent valables.

Si le projet est sur « Create multiple accounts », la connexion Google avec le même email échoue
en `auth/account-exists-with-different-credential` — code non mappé dans
`src/lib/auth/authErrors.ts`, l'utilisateur verrait un message générique.

Vérifier aussi que **E-mail/Mot de passe** et **Google** sont activés dans **Sign-in method**.

## 6. Vérifier

1. Se connecter dans l'app → doit arriver sur `/(backoffice)/(tabs)/dashboard`
   (`resolveAuthRoute` ne renvoie `backoffice` que si `role === "backoffice"` **et**
   `status === "active"`).
2. Ouvrir **Réglages → Gérer les entreprises** : cet écran lit `companies`, lecture protégée par
   `isBackoffice()` — s'il s'affiche, les claims sont bien dans l'ID token.

## Dépannage

### `403` / `PERMISSION_DENIED` sur `identitytoolkit.googleapis.com`

```
"The identitytoolkit.googleapis.com API requires a quota project, which is not set by default."
"reason": "SERVICE_DISABLED", "consumer": "projects/<numéro>"
```

Les identifiants de Cloud Shell sont ceux d'un **compte utilisateur**, et non d'un compte de
service : Google exige alors un *quota project* explicite, sinon l'appel est facturé au projet par
défaut du shell — souvent un autre projet, où l'API Identity Toolkit n'est pas activée (d'où le
`SERVICE_DISABLED` sur un numéro de consommateur inattendu ; celui de `bike-eco-43a84` est
**585450098034**, cf. `google-services.json`).

`firebase-admin` lit la variable `GOOGLE_CLOUD_QUOTA_PROJECT` et l'envoie en en-tête
`x-goog-user-project`. Il suffit donc de la poser avant de lancer le script :

```bash
gcloud config set project bike-eco-43a84       # aligne le shell sur le bon projet
export GOOGLE_CLOUD_QUOTA_PROJECT=bike-eco-43a84
node grant-backoffice.js --email … --prenom … --nom … --tel …
```

(`gcloud auth application-default set-quota-project bike-eco-43a84` est l'équivalent, mais il
échoue quand Cloud Shell n'a pas de fichier ADC local — la variable d'environnement est le chemin
fiable.)

Si le `403` persiste :

- **mauvais compte** — `gcloud auth list` : le compte actif doit avoir un rôle sur
  `bike-eco-43a84`. Sinon, `gcloud auth login`. Si `firebase-admin` ne s'authentifie pas du tout,
  `gcloud auth application-default login`.
- **API réellement désactivée** sur le bon projet (improbable, Auth est utilisée en production) —
  `gcloud services enable identitytoolkit.googleapis.com --project=bike-eco-43a84`.

### Écran de connexion en boucle après le script

Le document `users/{uid}` manque ou est mal formé — relancer le script **tel quel** (sans
`--region` : la réparation ne doit pas réécrire la région gérée), puis se
déconnecter/reconnecter (les claims ne sont relues qu'au rafraîchissement du token).

## Gestion courante

Réinitialisation du mot de passe et désactivation : console Firebase →
**Authentication → Users**. Désactiver un compte suffit à couper l'accès immédiatement ; les
claims restent posées mais l'authentification échoue.

**Suppression** : `scripts/delete-backoffice.js` (voir `manage-accounts.md`), pas la console —
elle laisse derrière elle le document `users/{uid}`, inaccessible et devenu des données
personnelles orphelines. Le script refuse aussi de supprimer le dernier compte back-office
actif, sans lequel plus aucune entreprise ne peut être validée.

Cette procédure ne sert qu'à amorcer le **tout premier** compte back-office. Pour les suivants,
voir [Comptes back-office suivants](#comptes-back-office-suivants) ci-dessous.

## Comptes back-office suivants

Ce script ne sert qu'au **premier** compte back-office. Une fois qu'il existe et
qu'il est administrateur, les membres suivants s'invitent depuis l'application :
Paramètres → "Inviter un membre de l'équipe Bike-eco". L'invité reçoit un code à
usage unique valable 1 heure, suit le parcours d'inscription invité — où il choisit
sa **région gérée** (champ optionnel, "Toute la France" par défaut) —, et obtient un
compte back-office **actif** et **non administrateur** — à promouvoir ensuite depuis
la page Collaborateur si besoin.

### Inviter hors application

`scripts/invite-backoffice.js` fait la même chose que cet écran, depuis Cloud Shell :
il écrit l'unique document `invitations/{id}` — le **hash** d'un code à 6 caractères,
valable 1 heure — et envoie l'email d'invitation. À réserver aux cas où personne ne
peut atteindre l'écran (aucun admin connecté, application indisponible, invitation à
renvoyer dans l'urgence) ; l'écran reste le chemin normal.

```bash
npm i firebase-admin nodemailer

node invite-backoffice.js --email nouveau@bike-eco.fr
```

Contrairement à `grant-backoffice.js`, ce script ne crée **aucun** compte : rien
n'existe tant que l'invité n'a pas saisi son code, et l'invitation expire d'elle-même
au bout d'une heure. L'invité choisit son mot de passe et sa région gérée, et obtient
le même compte **actif** et **non administrateur** qu'une invitation faite depuis
l'application.

`--isAdmin` donne au contraire un compte **administrateur** d'emblée, sans passer
par la promotion depuis « Mes collaborateurs ». Le drapeau est porté par le document
d'invitation, pas par le formulaire d'inscription : l'invité ne peut donc pas se
promouvoir lui-même en modifiant sa requête, c'est `acceptInvite` qui relit le champ.
Une invitation ainsi marquée transforme le code en code d'**administrateur** —
à traiter en conséquence.

`invitedBy` vaut la valeur littérale `admin-script` : aucune session n'a envoyé cette
invitation, et y mettre l'uid d'un administrateur lui en attribuerait l'envoi. En
contrepartie `delete-backoffice.js`, qui nettoie les invitations d'un administrateur
supprimé via `invitedBy == uid`, ne les voit pas : elles disparaissent en étant
utilisées, et sont de toute façon mortes une heure après leur envoi.

Les identifiants SMTP sont lus dans les mêmes secrets que les fonctions
(`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`), via le `gcloud` déjà installé
dans Cloud Shell. S'ils sont illisibles le script s'arrête **avant** d'écrire : une
invitation sans email pour porter son code ne sert à rien.

Deux drapeaux optionnels :

- `--dry-run` affiche ce qui serait écrit et envoyé, sans rien faire.
- `--show-code` affiche le code en clair, secours si l'email n'arrive pas. Il
  n'est stocké que haché, donc irrécupérable après coup : sans ce drapeau, un email
  perdu se règle en relançant le script. Ne le transmettre que par un canal sûr — il
  crée un compte back-office.

Relancer le script n'est **pas** idempotent : chaque exécution émet un nouveau code et
un nouvel email. Les codes précédents restent valables jusqu'à leur expiration.
