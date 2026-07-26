# Créer et supprimer des comptes sur le projet live

Trois scripts d'exploitation sur `bike-eco-43a84`, à lancer depuis **Cloud Shell** comme
`grant-backoffice.js` (voir `first-backoffice-account.md` pour la procédure détaillée :
ouverture de Cloud Shell, `cloudshell edit <fichier>`, `npm i firebase-admin`). Les
identifiants sont ceux de votre compte Google — **aucune clé de compte de service** à
créer ni à télécharger.

| Script | Rôle |
| ------ | ---- |
| `scripts/create-b2b.js` | crée (ou répare) un compte vendeur b2b, avec ou sans son entreprise |
| `scripts/delete-b2b-user.js` | supprime **entièrement** un compte b2b : Auth, profil, dossiers, fichiers, invitations |
| `scripts/delete-backoffice.js` | supprime **entièrement** un compte back-office : Auth + profil |

La suppression est séparée par rôle parce que les deux n'ont rien à nettoyer de commun :
un compte back-office n'a ni entreprise ni dossier (le funnel de dépôt est réservé au b2b),
là où un compte b2b traîne des dossiers, des fichiers Storage et des invitations. Chaque
script **refuse** les comptes de l'autre et renvoie vers le bon.

Pour créer un compte back-office : `grant-backoffice.js`, voir `first-backoffice-account.md`.

Ces scripts écrivent en admin : ils contournent les règles de sécurité et ne demandent
aucune validation back-office. À réserver aux cas que le produit ne couvre pas.

---

## Créer un compte b2b

Le parcours produit (`registerCompany`, puis « Inviter un collègue ») crée toujours un
compte **`pending`**, débloqué par la validation back-office. Ce script fait les mêmes
trois écritures serveur — utilisateur Auth, custom claims, document `users/{uid}` dans
**`bike-eco-db`** — mais sait rattacher le compte à une entreprise existante et le rendre
`active` immédiatement.

**Rattacher à une entreprise existante** (son id est visible dans l'URL back-office) :

```bash
node create-b2b.js \
  --email   jean@garage-nord.fr \
  --prenom  Jean --nom Dupont --tel 0612345678 \
  --company comp_nord
```

**Créer aussi l'entreprise**, à partir du SIRET :

```bash
node create-b2b.js \
  --email       marie@garage-ouest.fr \
  --prenom      Marie --nom Leroy --tel 0698765432 \
  --siret       55555555500011 \
  --societe     "Garage de l'Ouest" \
  --departement "44 - Loire-Atlantique" \
  --ville       Nantes
```

Si le SIRET correspond déjà à une entreprise, celle-ci est réutilisée et
`--societe/--departement/--ville` sont inutiles. La `region` (NORTH / SOUTH) est déduite
du département exactement comme à l'inscription : elle décide quel centre Bike-eco voit
les dossiers de l'entreprise.

| Option | Effet |
| ------ | ----- |
| `--status pending` | reproduit le gate d'inscription (connexion possible, écran d'attente jusqu'à validation). Défaut : `active` |
| `--password <mdp>` | impose un mot de passe. Sans lui, un mot de passe temporaire aléatoire est généré et affiché |

Le script est **idempotent** : le relancer répare ce qui manque (compte Auth réutilisé,
claims reposées, profil complété).

Ensuite : console Firebase → **Authentication → Users** → **Reset password**, pour que le
mot de passe définitif ne soit connu que du titulaire. Si le compte était déjà connecté
quelque part, les claims ne sont relues qu'au rafraîchissement du jeton — se déconnecter
puis se reconnecter.

---

## Supprimer entièrement un compte b2b

Supprimer l'utilisateur Auth depuis la console **ne suffit pas** : le profil
`users/{uid}`, les dossiers soumis, leurs photos et pièces jointes dans Storage et les
invitations en cours survivent. Le profil est le plus gênant — un nouveau compte sur la
même adresse reçoit un nouvel uid, donc l'ancien document devient des données
personnelles orphelines et inaccessibles.

Le script supprime, dans l'ordre utilisé par la suppression d'entreprise du back-office
(**Storage d'abord**, pour ne jamais laisser de fichiers qu'aucun document ne référence) :

1. les fichiers `dossiers/{companyId}/{dossierId}/` de chaque dossier soumis,
2. ces dossiers et leur sous-collection `messages`,
3. les invitations qu'il a envoyées et celles adressées à son adresse,
4. l'utilisateur Auth,
5. le document `users/{uid}`.

```bash
node delete-b2b-user.js --email jean@garage-nord.fr          # simulation : affiche le plan
node delete-b2b-user.js --email jean@garage-nord.fr --yes    # supprime réellement
```

**La simulation est le comportement par défaut** : rien n'est écrit sans `--yes`. Le plan
affiche ce qui a été trouvé (rôle, entreprise, nombre de dossiers et d'invitations), à
relire avant de confirmer.

| Option | Effet |
| ------ | ----- |
| `--uid <uid>` | cible par uid — sert quand l'utilisateur Auth a déjà été supprimé et qu'il ne reste que le profil |
| `--keep-dossiers` | laisse les dossiers à l'entreprise (voir ci-dessous) |
| `--with-company` | supprime aussi l'entreprise, ses autres membres et tous ses dossiers — même cascade que « Supprimer l'entreprise » au back-office |

Cibler par `--email` retrouve aussi un profil dont l'utilisateur Auth a déjà disparu :
c'est exactement le résidu que ce script existe pour nettoyer.

### Les dossiers : supprimés par défaut

Un dossier appartient à l'entreprise, pas à la personne — mais il porte le nom du
déposant et ses photos sont des données d'entreprise. Par défaut les dossiers soumis par
le compte sont supprimés, ce qu'implique une vraie demande d'effacement (RGPD).
`--keep-dossiers` les conserve pour l'équipe restante ; leur `submittedBy` pointe alors
vers un uid inexistant, sans conséquence à l'affichage (le nom du déposant est dupliqué
dans `submitter`).

### Cas particuliers signalés par le script

- **Dernier membre d'une entreprise** : l'entreprise survit sans personne pour s'y
  connecter. Utiliser `--with-company`, ou la supprimer depuis le back-office.
- **Créateur de l'entreprise** : le champ `createdBy` reste pointé sur l'uid supprimé.
  Sans effet — la carte affiche `createdByName`.
- **Messages postés dans les dossiers d'autres comptes** : conservés. Ils portent un
  `senderName` dupliqué, et les supprimer amputerait la conversation de l'autre partie.

---

## Supprimer entièrement un compte back-office

Beaucoup plus simple : un compte back-office n'a pas d'entreprise et **ne peut pas déposer
de dossier** (le funnel est réservé au b2b). Il ne reste donc à supprimer que l'utilisateur
Auth et le document `users/{uid}` — ce dernier étant précisément ce que la console laisse
derrière elle.

```bash
node delete-backoffice.js --email alex@bike-eco.fr          # simulation : affiche le plan
node delete-backoffice.js --email alex@bike-eco.fr --yes    # supprime réellement
```

| Option | Effet |
| ------ | ----- |
| `--uid <uid>` | cible par uid — sert quand l'utilisateur Auth a déjà été supprimé et qu'il ne reste que le profil |
| `--force` | autorise la suppression du **dernier** compte back-office actif |

### Les deux refus du script

- **Dernier compte back-office actif.** Aucun parcours produit ne crée d'identité
  `backoffice` : sans lui, plus personne ne peut valider une entreprise, chaque
  inscription reste `pending` et chaque nouveau vendeur attend indéfiniment sans que
  l'application ne l'explique. Créer le remplaçant d'abord (`grant-backoffice.js`), ou
  passer `--force` en connaissance de cause.
- **Compte qui a déposé des dossiers.** Impossible en théorie, mais `grant-backoffice.js`
  réutilise un utilisateur Auth existant : un compte b2b promu back-office garde les
  dossiers déposés du temps où il était vendeur. Le script renvoie alors vers
  `delete-b2b-user.js`, seul à nettoyer les fichiers Storage et les messages.

Les messages postés dans les conversations sont conservés : ils portent un `senderName`
dupliqué, et les supprimer amputerait la conversation côté vendeur.

**Pour seulement couper l'accès**, ne pas supprimer : console Firebase →
**Authentication → Users → Disable account**. La connexion échoue immédiatement, les
claims et le profil restent intacts, et c'est réversible en un clic.

---

## Vérifier

Les scripts se testent sur les **émulateurs** avant la production, sans toucher au
projet live :

```bash
JAVA_HOME=/usr/local/jdk-26.0.1 npx -y firebase-tools@latest \
  emulators:start --only auth,firestore,storage --project bike-eco-43a84
npm run seed

export FIRESTORE_EMULATOR_HOST=localhost:8080 \
       FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
       FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
node scripts/create-b2b.js --email test@x.fr --prenom A --nom B --tel 0600000000 --company comp_nord
node scripts/delete-b2b-user.js --email test@x.fr --yes
node scripts/delete-backoffice.js --email bo@bike-eco.fr        # refus attendu : dernier actif
```

Les données sont dans `bike-eco-db` : <http://localhost:4000/firestore/bike-eco-db/data>.
