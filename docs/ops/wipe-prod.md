# Effacer toutes les données du projet live

`scripts/wipe-prod.js` vide **entièrement** `bike-eco-43a84` : tous les objets Storage,
tous les documents Firestore de `bike-eco-db`, tous les utilisateurs Auth. C'est le bouton
« repartir d'un projet vide » — une remise à zéro avant lancement, pas un outil de gestion
de comptes. Pour supprimer **une** personne, utiliser `delete-b2b-user.js` ou
`delete-backoffice.js` (voir `manage-accounts.md`), qui savent ce qu'un compte possède.

> **Rien n'est récupérable.** Firestore n'a pas d'annulation, ce bucket n'a pas
> d'historique de versions, et un utilisateur Auth supprimé ne revient pas — un nouveau
> compte sur la même adresse reçoit un nouvel uid, donc tout `submittedBy`, `invitedBy` ou
> `senderName` d'une copie qui survivrait ailleurs ne pointerait plus sur rien.

Comme les autres scripts d'exploitation : à lancer depuis **Cloud Shell**, avec les
identifiants de votre compte Google, **aucune clé de compte de service** (voir
`first-backoffice-account.md` pour l'ouverture de Cloud Shell, `cloudshell edit <fichier>`
et `npm i firebase-admin`).

```bash
node wipe-prod.js                                     # simulation : affiche le plan
node wipe-prod.js --keep-backoffice \
                  --yes --confirm bike-eco-43a84      # efface réellement
```

**La simulation est le comportement par défaut**, et `--yes` seul ne suffit pas :
`--confirm` doit épeler l'id du projet. Un effacement total ne peut donc jamais être une
commande rappelée dans l'historique du shell.

| Option | Effet |
| ------ | ----- |
| `--only <liste>` | limite à `storage`, `firestore`, `auth` (défaut : les trois) |
| `--keep-backoffice` | conserve les comptes back-office : Auth, `users/{uid}` et ses `pushTokens` |
| `--keep <emails>` | idem, pour une liste d'adresses séparées par des virgules |
| `--yes --confirm bike-eco-43a84` | applique |

## Ce qui est supprimé, dans cet ordre

1. **tous les objets du bucket** (tout y est sous `dossiers/{companyId}/…`),
2. **tous les documents de toutes les collections racines**, avec leurs sous-collections
   (`messages`, `mutes`, `pushTokens`) — une sous-collection ne part pas avec son document
   parent, un `delete()` simple les laisserait orphelines,
3. **tous les utilisateurs Auth**, par lots de 1000.

Storage d'abord, pour ne jamais laisser de fichiers qu'aucun document ne référence ; Auth
en dernier, pour qu'une exécution interrompue reste relançable (les comptes restent
trouvables tant qu'ils existent). Le script énumère les collections avec
`listCollections()` plutôt qu'une liste en dur : une collection créée après coup part avec
le reste. Relancer sur un projet déjà vide ne fait rien.

**Ne sont pas touchés** : les règles de sécurité, les index, les fonctions déployées, la
configuration du projet. Le script n'enlève que des données.

## Garder de quoi se reconnecter

Sans `--keep-backoffice` ni `--keep`, plus personne ne peut se connecter : **aucun parcours
produit ne crée de compte back-office**. Il faut alors repasser par
`grant-backoffice.js` (voir `first-backoffice-account.md`) pour recréer un accès. Le script
le signale dans le plan.

`--keep-backoffice` est le choix habituel pour une remise à zéro des données qui conserve
les accès de l'équipe. Deux détails :

- Un compte gardé qui n'est **pas** back-office garde son claim `companyId`, qui pointe
  alors sur une entreprise supprimée : l'application le traite comme un compte sans
  entreprise. Le script prévient.
- Une adresse passée à `--keep` sans utilisateur Auth correspondant **arrête le script** :
  une faute de frappe supprimerait silencieusement le compte qu'on voulait sauver.

## Vérifier

Le script se répète sur les **émulateurs** avant la production, sans toucher au projet
live — il affiche `EMULATORS` au lieu de `LIVE PROJECT` quand les variables d'émulateur
sont posées :

```bash
JAVA_HOME=/usr/local/jdk-26.0.1 npx -y firebase-tools@latest \
  emulators:start --only auth,firestore,storage --project bike-eco-43a84
npm run seed

export FIRESTORE_EMULATOR_HOST=localhost:8080 \
       FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
       FIREBASE_STORAGE_EMULATOR_HOST=localhost:9199
node scripts/wipe-prod.js --keep-backoffice
node scripts/wipe-prod.js --keep-backoffice --yes --confirm bike-eco-43a84
```

Les données sont dans `bike-eco-db` : <http://localhost:4000/firestore/bike-eco-db/data>.
`npm run seed` les remet en place ensuite.
