# Créer un compte back-office sur le projet live

Procédure à faire soi-même, ~5 minutes, sur `bike-eco-43a84`. Nécessaire au moins une fois :
aucun parcours produit ne crée de compte back-office (`registerCompany` et `sendInvite` sont
réservés au rôle `b2b`), donc le premier admin est amorcé hors application. La même procédure
sert pour les suivants.

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

Le script affiche l'UID créé. Si `firebase-admin` refuse de s'authentifier, lancer d'abord
`gcloud auth application-default login` dans Cloud Shell.

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

En cas d'écran de connexion en boucle : le document `users/{uid}` manque ou est mal formé —
relancer le script, puis se déconnecter/reconnecter (les claims ne sont relues qu'au
rafraîchissement du token).

## Gestion courante

Réinitialisation du mot de passe et désactivation : console Firebase →
**Authentication → Users**. Désactiver un compte suffit à couper l'accès immédiatement ; les
claims restent posées mais l'authentification échoue.

**Suppression** : `scripts/delete-backoffice.js` (voir `manage-accounts.md`), pas la console —
elle laisse derrière elle le document `users/{uid}`, inaccessible et devenu des données
personnelles orphelines. Le script refuse aussi de supprimer le dernier compte back-office
actif, sans lequel plus aucune entreprise ne peut être validée.

Créer d'autres comptes back-office **depuis l'application** (« Inviter un collègue », aujourd'hui
un stub) demanderait d'étendre le flux d'invitation au rôle `backoffice` — chantier séparé. En
attendant, rejouer cette procédure.
