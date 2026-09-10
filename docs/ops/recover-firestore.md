# Récupérer des données Firestore effacées ou corrompues

Que faire quand des données de `bike-eco-db` ont disparu ou ont été abîmées : une suppression
en cascade qui a emporté trop de choses, un script d'exploitation lancé sur le mauvais projet,
un bug qui a réécrit des documents.

À lire **avant** l'incident, au moins une fois. Une restauration Firestore n'est pas une
commande unique et n'a rien d'instantané : la procédure complète prend de 30 minutes à
plusieurs heures selon le volume.

Comme les autres procédures d'exploitation : tout se passe dans le navigateur via **Cloud
Shell**, avec les identifiants de votre propre compte Google et **aucune clé de compte de
service** (voir `first-backoffice-account.md` pour l'ouverture de Cloud Shell).

## Ce qui est protégé aujourd'hui

| Protection | État | Ce que ça couvre |
| ---------- | ---- | ---------------- |
| **Protection contre la suppression** | activée | empêche la suppression de la base `bike-eco-db` elle-même |
| **PITR** (récupération à un instant précis) | activée | revenir à **n'importe quelle minute des 7 derniers jours** |
| **Sauvegarde hebdomadaire** | tous les **lundis**, conservée **35 jours** | revenir à un lundi, jusqu'à 5 semaines en arrière |

Les deux se complètent et ne font pas double emploi : le PITR couvre les 7 derniers jours à la
minute près, les sauvegardes couvrent les semaines 1 à 5 — le cas « on s'en aperçoit trois
semaines plus tard ».

> **Le PITR ne remonte pas dans le passé.** Il a été activé le **10 septembre 2026 à 19 h 26
> UTC** et ne conserve les versions qu'**à partir de cette date**. La fenêtre s'est élargie
> jour après jour et n'a atteint ses 7 jours complets que le **17 septembre 2026**. Avant cette
> date, il était impossible de remonter plus loin que le moment de l'activation.

Vérifier l'état à tout moment :

```bash
npx -y firebase-tools@latest firestore:databases:get bike-eco-db --project bike-eco-43a84
npx -y firebase-tools@latest firestore:backups:schedules:list --database bike-eco-db --project bike-eco-43a84
```

Dans la fiche de la base, `Version Retention Period` doit valoir `604800s` (7 jours). S'il
affiche `3600s`, **le PITR est désactivé** et la fenêtre n'est que d'une heure.

## Ce qui n'est PAS protégé

| Non couvert | Conséquence |
| ----------- | ----------- |
| **Cloud Storage** (les photos des dossiers) | ni le PITR ni les sauvegardes Firestore ne contiennent les fichiers. Restaurer la base ramène les documents `dossiers` et leurs `photoUrls`, mais **les URL pointeront vers des fichiers absents** si les photos ont été supprimées. |
| **Les comptes Firebase Auth** | un utilisateur Auth supprimé ne revient pas. Recréé sur la même adresse, il reçoit un **nouvel uid**, donc les `submittedBy`, `invitedBy` et `senderName` restaurés ne pointeront plus sur rien. |
| **Les règles de sécurité, les index, les fonctions** | ils vivent dans ce dépôt, pas dans la base. On les redéploie, on ne les restaure pas. |

Cloud Storage applique par défaut une **suppression réversible de 7 jours** (*soft delete*) :
un fichier effacé reste récupérable une semaine. Ce réglage n'a pas été vérifié sur ce projet —
à contrôler dans la console (Cloud Storage → le bucket → Protection) **avant** d'en dépendre.

## ⚠️ La règle qui surprend tout le monde

**Aucune restauration ne remet `bike-eco-db` dans son état passé.**

Les deux commandes de récupération (`clone` pour le PITR, `restore` pour une sauvegarde) créent
une **nouvelle base**, à côté de la base live, qui continue de tourner sans être touchée.

C'est une bonne nouvelle — l'application ne s'arrête pas, les testeurs ne voient rien — mais ça
veut dire que la récupération se fait **en trois temps** :

1. créer une base temporaire à partir du PITR ou d'une sauvegarde ;
2. **recopier à la main** les documents concernés vers `bike-eco-db` ;
3. supprimer la base temporaire (elle est facturée comme une base normale).

Il n'existe pas de bouton « revenir en arrière ». L'application est câblée en dur sur
`bike-eco-db` (`firebase.json`, `firebaseConfig.ts`, `functions/src/callable.ts`) : basculer
l'application vers la base restaurée demanderait de modifier le code, de redéployer les
fonctions **et** de publier une nouvelle version de l'application mobile. Ce n'est pas la voie
à suivre — on recopie les documents.

## Quel outil pour quel incident

| Situation | Outil | Section |
| --------- | ----- | ------- |
| « on a effacé ça il y a deux heures » | PITR | [A](#a--récupérer-par-pitr-7-derniers-jours) |
| « le bug tourne depuis mardi dernier » | PITR si < 7 jours, sinon sauvegarde | [A](#a--récupérer-par-pitr-7-derniers-jours) / [B](#b--restaurer-une-sauvegarde-hebdomadaire) |
| « on s'en aperçoit trois semaines après » | sauvegarde hebdomadaire | [B](#b--restaurer-une-sauvegarde-hebdomadaire) |
| « juste savoir ce que contenait ce document hier » | PITR, lecture seule | [A](#a--récupérer-par-pitr-7-derniers-jours) puis lire la base temporaire sans rien recopier |

**Avant toute chose : noter l'heure.** L'instant qui compte est le **dernier moment où les
données étaient encore correctes**, en **UTC**. Sans cette information, aucune des deux
procédures ne peut être lancée correctement.

## A — Récupérer par PITR (7 derniers jours)

### 1. Choisir l'instant

Format ISO 8601, en UTC, **à la minute pleine** (les secondes doivent être `00`) :

```
2026-09-14T08:35:00Z
```

Cet instant doit être **postérieur** au `Earliest Version Time` affiché par
`firestore:databases:get`. Plus tôt, la commande échoue.

### 2. Cloner vers une base temporaire

> **Attention au format.** `clone` exige des **noms de ressource complets**
> (`projects/…/databases/…`) pour la source **et** pour la cible. Un simple `bike-eco-db`
> provoque l'erreur `Error parsing database name`. C'est différent de `restore` (section B),
> qui attend un identifiant court — la confusion entre les deux est l'erreur la plus fréquente.

```bash
npx -y firebase-tools@latest firestore:databases:clone \
  projects/bike-eco-43a84/databases/bike-eco-db \
  projects/bike-eco-43a84/databases/recovery-20260914 \
  --snapshot-time 2026-09-14T08:35:00Z \
  --project bike-eco-43a84
```

`recovery-20260914` est un nom libre : choisir quelque chose de daté et sans ambiguïté. La base
ne doit pas déjà exister. Le clonage entre projets différents n'est pas possible.

Sans `--snapshot-time`, la commande clone la minute en cours — c'est-à-dire **l'état abîmé**.
Ne jamais omettre cette option lors d'une récupération.

### 3. Suivre l'avancement

La commande rend la main immédiatement : le clonage se poursuit en arrière-plan. Elle affiche
la commande de suivi à utiliser, de la forme :

```bash
npx -y firebase-tools@latest firestore:operations:describe \
  --database="recovery-20260914" <nom-de-l-opération> --project bike-eco-43a84
```

Attendre que l'opération soit terminée avant de lire quoi que ce soit. Passer ensuite à la
section [Recopier les documents](#recopier-les-documents-vers-bike-eco-db).

## B — Restaurer une sauvegarde hebdomadaire

### 1. Lister les sauvegardes disponibles

```bash
npx -y firebase-tools@latest firestore:backups:list \
  --location europe-west9 --project bike-eco-43a84
```

Relever le **nom complet** de la sauvegarde voulue, de la forme
`projects/bike-eco-43a84/locations/europe-west9/backups/…`.

### 2. Restaurer vers une base temporaire

> Ici, `--database` est un **identifiant court** (pas un nom de ressource), alors que
> `--backup` est un **nom de ressource complet**. L'inverse de la section A.

```bash
npx -y firebase-tools@latest firestore:databases:restore \
  --database recovery-20260914 \
  --backup projects/bike-eco-43a84/locations/europe-west9/backups/<id> \
  --project bike-eco-43a84
```

Là encore l'opération se poursuit en arrière-plan.

## Recopier les documents vers `bike-eco-db`

C'est l'étape manuelle, et c'est normal : seule une personne qui connaît l'incident sait quels
documents doivent revenir et lesquels doivent rester tels quels.

> **Ne jamais recopier la base entière par-dessus la base live.** Depuis l'incident, des
> testeurs ont pu créer des dossiers et envoyer des messages légitimes. Un écrasement global
> les détruirait — on remplacerait une perte par une autre.

### Repérer ce qui manque

Les deux bases sont lisibles côte à côte dans la console Firebase (le sélecteur de base est en
haut de l'écran Firestore). Comparer d'abord à l'œil, sur quelques documents, pour confirmer
que la base temporaire contient bien ce qu'on cherche **avant** d'écrire quoi que ce soit.

### Recopier

Depuis Cloud Shell, avec `firebase-admin` (`npm i firebase-admin`), en ouvrant **deux** clients,
un par base. Le squelette ci-dessous recopie une liste de dossiers ; l'adapter à l'incident.

```js
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp({ projectId: "bike-eco-43a84" });

// Un client par base. `getFirestore(<id>)` vise une base nommée — c'est le
// motif utilisé par les scripts du dépôt (voir `scripts/wipe-prod.js`).
// Sans identifiant, on écrirait dans `(default)`, qui est vide : erreur classique.
const live = getFirestore("bike-eco-db");
const source = getFirestore("recovery-20260914");

const DRY_RUN = true;                                 // passer à false seulement après relecture
const IDS = ["dossier-1", "dossier-2"];               // la liste établie à l'étape précédente

(async () => {
  for (const id of IDS) {
    const snap = await source.collection("dossiers").doc(id).get();
    if (!snap.exists) { console.log("absent de la source :", id); continue; }

    const existing = await live.collection("dossiers").doc(id).get();
    if (existing.exists) { console.log("existe déjà en live, ignoré :", id); continue; }

    console.log(DRY_RUN ? "[simulation] écrirait" : "écrit", id);
    if (!DRY_RUN) await live.collection("dossiers").doc(id).set(snap.data());
  }
})();
```

Trois précautions, toutes les trois indispensables :

- **`DRY_RUN = true` d'abord**, systématiquement. Lire la sortie en entier avant de le passer à
  `false`. C'est la même convention que `wipe-prod.js` et `delete-b2b-user.js`.
- **Ne pas écraser un document qui existe déjà** en live sans l'avoir décidé explicitement — le
  `continue` ci-dessus est là pour ça.
- **Les sous-collections ne suivent pas leur parent.** Un dossier a des `messages` et des
  `mutes` ; un utilisateur a des `pushTokens`. Recopier le document parent ne les ramène pas :
  il faut les parcourir et les recopier une par une (même remarque que dans `wipe-prod.md`).

Les collections du modèle sont listées dans `src/lib/firestore/schema.ts` : `companies`,
`users` (+ `pushTokens`), `invitations`, `dossiers` (+ `messages`, `mutes`).

## Supprimer la base temporaire

**À ne pas oublier : une base clonée ou restaurée est facturée comme une base normale**, aussi
longtemps qu'elle existe.

```bash
npx -y firebase-tools@latest firestore:databases:delete recovery-20260914 --project bike-eco-43a84
```

Si la suppression est refusée à cause de la protection contre la suppression, la retirer
d'abord **sur la base temporaire uniquement** — jamais sur `bike-eco-db` :

```bash
npx -y firebase-tools@latest firestore:databases:update recovery-20260914 \
  --delete-protection DISABLED --project bike-eco-43a84
```

Vérifier ensuite qu'il ne reste bien qu'une base :

```bash
npx -y firebase-tools@latest firestore:databases:list --project bike-eco-43a84
```

## Une base restaurée est fermée par défaut

Les bases créées par `clone` et `restore` reçoivent des **règles de sécurité fermées** : aucun
accès client. C'est voulu, et il ne faut pas y toucher — la base temporaire n'a pas à être
accessible depuis l'application. La lecture se fait depuis Cloud Shell ou la console, avec vos
droits de projet, qui ne passent pas par les règles.

## Ce que ça coûte

| Poste | Tarif | Remarque |
| ----- | ----- | -------- |
| PITR | 0,00020 $ / Gio / heure | ≈ **0,15 $ par Gio et par mois** |
| Sauvegardes | 0,00004 $ / Gio / heure et par copie conservée | ≈ **0,03 $ par Gio, par mois et par copie** — ici environ 5 copies |
| Base temporaire | tarif d'une base normale | **d'où l'importance de la supprimer** |

Aucun de ces postes n'entre dans le palier gratuit, même en plan Blaze.

Concrètement, les données Firestore de ce projet sont du texte — les photos sont dans Cloud
Storage, pas dans la base. L'ensemble coûte donc **quelques centimes par mois**. La facture ne
deviendrait significative que si la base atteignait plusieurs Gio, ce que le modèle actuel ne
permet pas.

## S'entraîner avant d'en avoir besoin

Une sauvegarde jamais restaurée n'est pas une sauvegarde. **Une fois, à froid**, dérouler la
procédure en entier :

1. cloner par PITR sur un instant d'il y a une heure, vers `drill-<date>` ;
2. ouvrir la base dans la console et vérifier qu'elle contient bien les dossiers attendus ;
3. recopier **un seul** document de test vers `bike-eco-db` ;
4. supprimer `drill-<date>` ;
5. vérifier avec `firestore:databases:list` qu'il ne reste qu'une base.

L'exercice coûte quelques centimes et prend une demi-heure. Il vaut mieux découvrir les erreurs
de format de nom de base à ce moment-là qu'en pleine perte de données.

## Modifier la configuration

```bash
# changer la fréquence ou la durée de conservation : supprimer puis recréer
npx -y firebase-tools@latest firestore:backups:schedules:list --database bike-eco-db --project bike-eco-43a84
npx -y firebase-tools@latest firestore:backups:schedules:delete <nom-complet-du-planning> --project bike-eco-43a84
npx -y firebase-tools@latest firestore:backups:schedules:create --database bike-eco-db \
  --recurrence WEEKLY --day-of-week MONDAY --retention 35d --project bike-eco-43a84
```

La conservation d'une sauvegarde va jusqu'à 14 semaines ; la fenêtre PITR est fixe à 7 jours et
ne se règle pas.

**Désactiver le PITR efface immédiatement l'historique conservé**, et le réactiver ne le
ramène pas : la fenêtre repart de zéro. Ne le désactiver que délibérément.

## Le jour où tout sera effacé

Le projet est en phase de test et ses données seront remises à zéro avant le lancement (voir
`wipe-prod.md`). Ni la protection contre la suppression, ni le PITR, ni le planning de
sauvegarde ne gênent cette opération : `wipe-prod.js` supprime des **documents**, pas la base.

En revanche, après une remise à zéro volontaire, le PITR conserve encore pendant 7 jours de
quoi ressusciter les données effacées. C'est sans danger, mais à savoir si l'objectif de la
remise à zéro était de faire disparaître des données personnelles : il faut alors désactiver le
PITR pour que cet historique disparaisse.
