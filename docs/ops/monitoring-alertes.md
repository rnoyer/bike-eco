# Être prévenu quand le serveur casse

Avant cette mise en place, une fonction Cloud pouvait échouer sans que personne ne
l'apprenne : l'erreur partait dans un journal que personne ne lit. Trois pannes étaient
silencieuses **par construction** :

| Endroit | Ce qui se passait |
| ------- | ----------------- |
| `functions/src/notifications/index.ts` | l'envoi des notifications push échoue → l'erreur est écrite dans le journal et **rien n'est relancé** (c'est voulu : `retry: false`) |
| `functions/src/index.ts` | l'envoi des emails du formulaire public échoue → le client reçoit une erreur 502, **la demande est perdue** |
| `functions/src/callable.ts` | n'importe laquelle des seize fonctions échoue → une ligne `Callable failed` |

Deux règles d'alerte envoient maintenant un email quand l'un de ces cas se produit.

Tout se passe dans le navigateur via **Cloud Shell**, avec les identifiants de votre propre
compte Google et **aucune clé de compte de service** (voir `first-backoffice-account.md`
pour l'ouverture de Cloud Shell).

## Ce qui est surveillé

| Règle | Ce qu'elle attrape | Délai entre deux emails |
| ----- | ------------------ | ----------------------- |
| **Bike-eco - erreur formulaire public B2C** | toute erreur de `sendB2cSubmission` | 5 minutes |
| **Bike-eco - erreur fonction** | toute erreur de n'importe quelle autre fonction | 30 minutes |

Le formulaire public est séparé du reste parce qu'il n'a pas de filet : **rien n'est
enregistré en base**, l'email est le seul livrable. Une erreur là, c'est un client perdu
sans trace. Une erreur ailleurs concerne un utilisateur connecté, qui peut réessayer et
vous le dire.

> **Les deux règles se déclenchent sur la gravité et sur le nom de la fonction, jamais sur
> le texte du message.** C'est délibéré : un texte de message finit toujours par être
> modifié, et une alerte accrochée à un texte cesse alors de se déclencher — sans erreur,
> sans avertissement, définitivement. C'est exactement la panne silencieuse que tout ceci
> sert à supprimer, et il serait absurde de la réintroduire dans la surveillance elle-même.

Ce que ça implique : **une nouvelle fonction est surveillée automatiquement**, sans rien
faire. Il n'y a pas de liste de fonctions à tenir à jour.

## Installer

```bash
cloudshell edit setup-alerts.sh     # y coller le contenu de scripts/setup-alerts.sh

DRY_RUN=1 bash setup-alerts.sh      # affiche le plan, ne crée rien
bash setup-alerts.sh                # crée ce qui manque
```

Le script est **idempotent** : ce qui existe déjà est signalé et laissé tel quel. Le
relancer après une erreur en cours de route reprend là où il s'était arrêté, sans créer de
doublon.

Pour changer l'adresse prévenue :

```bash
ALERT_EMAIL="autre@exemple.fr" bash setup-alerts.sh
```

Attention : cela crée un **second** canal, il ne remplace pas le premier. Pour vraiment
changer d'adresse, supprimer l'ancien canal dans la console une fois le nouveau en place.

### L'étape qu'il ne faut pas sauter

À la fin, le script affiche l'état du canal. **`UNVERIFIED` signifie que le canal ne
délivre rien du tout.** Il faut alors le vérifier depuis la console :

> Monitoring → Alerting → Edit notification channels → la ligne du canal → vérifier

`VERIFIED`, ou un état vide, veut dire qu'il fonctionne.

## Vérifier que l'alerte fonctionne vraiment

Cloud Monitoring **ne propose pas** de bouton « envoyer une notification de test » pour un
canal email (seul Slack en a un). La seule preuve honnête est de faire se déclencher une
règle pour de vrai, avec une règle jetable.

Le principe : créer une règle temporaire qui se déclenche sur quelque chose de **normal et
fréquent**, confirmer que l'email arrive, puis la supprimer. On ne casse rien.

```bash
# 1. récupérer le canal
CHANNEL=$(gcloud beta monitoring channels list --project bike-eco-43a84 \
  --filter="displayName='Bike-eco - alertes techniques'" --format='value(name)')

# 2. une règle jetable sur les avertissements (fréquents, anodins)
cat > /tmp/test-policy.json <<JSON
{
  "displayName": "ZZZ test jetable - a supprimer",
  "combiner": "OR",
  "enabled": true,
  "documentation": { "content": "Test de la chaine d'alerte.", "mimeType": "text/markdown" },
  "conditions": [{
    "displayName": "Test",
    "conditionMatchedLog": {
      "filter": "resource.type=\"cloud_run_revision\" AND labels.\"goog-managed-by\"=\"cloudfunctions\" AND severity>=WARNING"
    }
  }],
  "alertStrategy": { "notificationRateLimit": { "period": "300s" }, "autoClose": "1800s" },
  "notificationChannels": ["$CHANNEL"]
}
JSON
gcloud monitoring policies create --project bike-eco-43a84 --policy-from-file=/tmp/test-policy.json

# 3. provoquer un avertissement : envoyer un message depuis l'application à
#    quelqu'un qui n'a pas de téléphone enregistré ("No registered device").
#    Puis attendre quelques minutes et surveiller la boîte mail.

# 4. TOUJOURS supprimer la règle de test ensuite
POLICY=$(gcloud monitoring policies list --project bike-eco-43a84 \
  --filter="displayName='ZZZ test jetable - a supprimer'" --format='value(name)')
gcloud monitoring policies delete "$POLICY" --project bike-eco-43a84
```

Si l'email n'arrive pas, le problème est presque toujours le canal `UNVERIFIED`
ci-dessus, ou le message classé en indésirable.

## Quand une alerte arrive

L'email contient le nom de la fonction et, quand la panne vient d'une fonction appelable,
l'identifiant de l'utilisateur concerné. Pour la suite, ouvrir le journal :

> Console → Logging → Explorateur de journaux, et coller :

```
resource.type="cloud_run_revision"
labels."goog-managed-by"="cloudfunctions"
severity>=ERROR
```

Ou depuis Cloud Shell, sans passer par la console :

```bash
npx -y firebase-tools@latest functions:log --project bike-eco-43a84
```

### Lire la ligne « Callable failed »

C'est la ligne écrite quand une des seize fonctions appelables échoue pour une raison
imprévue. Elle porte quatre champs, et ce sont eux qu'il faut regarder :

| Champ | À quoi il sert |
| ----- | -------------- |
| `function` | **quelle** fonction a échoué |
| `uid` | **quel** compte était concerné — `anonymous` si la personne n'était pas connectée |
| `errorName` | la classe de l'erreur (`TypeError`, `FirebaseError`…) |
| `stack` | l'endroit exact dans le code |

> Le nom est celui du service Cloud Run, qui est **en minuscules** : `registerCompany`
> apparaît sous la forme `registercompany`. C'est la même fonction.

Avec `uid`, on retrouve la personne :

```bash
npx -y firebase-tools@latest auth:export /tmp/u.json --project bike-eco-43a84
```

…ou plus simplement en ouvrant `users/{uid}` dans la console Firestore.

### Ce qui ne déclenche pas d'alerte, et c'est normal

Les avertissements (`WARNING`) ne réveillent personne, parce qu'ils décrivent des
situations attendues :

- `No registered device for recipient` — la personne n'a pas installé l'application ou a
  refusé les notifications. Ce n'est pas une panne.
- `Payload validation failed` — un formulaire mal rempli. C'est le travail de la
  validation, pas un incident.

De même, les erreurs **fonctionnelles** (`RegError`, erreur de validation Zod, adresse
email déjà utilisée) ne sont volontairement pas journalisées en erreur : ce sont des
réponses normales adressées à l'utilisateur. C'est ce qui permet à `severity>=ERROR` de
vouloir dire « quelque chose est cassé » et de rester une alerte crédible.

## Ce qui n'est PAS surveillé

| Non couvert | Pourquoi c'est important |
| ----------- | ------------------------ |
| **Les plantages de l'application mobile** | aucun outil de rapport de crash n'est installé. Un écran blanc chez un testeur ne produit aucune trace. |
| **Le dépassement de budget** | à configurer séparément (Facturation → Budgets et alertes). Fortement conseillé tant qu'App Check n'est pas activé sur le formulaire public, qui est ouvert à tous. |
| **Firestore et Storage** | quotas, latence, règles refusées : rien n'est surveillé ici. |
| **Le fait qu'une fonction ne soit plus appelée du tout** | une panne côté client ne produit aucune erreur serveur — donc aucune alerte. Le silence n'est pas surveillé, seules les erreurs le sont. |

## Modifier ou supprimer

```bash
# lister
gcloud monitoring policies list --project bike-eco-43a84 --format='table(name,displayName,enabled)'
gcloud beta monitoring channels list --project bike-eco-43a84 --format='table(name,displayName,verificationStatus)'

# suspendre sans supprimer (utile pendant une maintenance bruyante)
gcloud monitoring policies update <nom-complet> --project bike-eco-43a84 --no-enabled

# supprimer
gcloud monitoring policies delete <nom-complet> --project bike-eco-43a84
```

Pour changer un seuil ou un filtre : supprimer la règle et relancer `setup-alerts.sh`
après avoir modifié le script. Le script est la référence — une règle modifiée à la main
dans la console sera écrasée dès qu'on la recrée, et personne ne saura pourquoi elle avait
été changée.

## Ce que ça coûte

Les règles d'alerte et les canaux de notification ne sont pas facturés au nombre de
règles. Le coût réel de l'observabilité est celui de **l'ingestion des journaux**, qui
dispose d'un palier gratuit large (50 Gio par projet et par mois) — très au-delà de ce que
produit ce projet.

Voir <https://cloud.google.com/products/observability/pricing> pour les montants à jour.
