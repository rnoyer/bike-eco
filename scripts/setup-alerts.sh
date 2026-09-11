#!/usr/bin/env bash
#
# Create the Cloud Monitoring alerting for bike-eco: one email notification
# channel and two log-based alert policies over the deployed Cloud Functions.
#
# Run it from Cloud Shell (see docs/ops/monitoring-alertes.md). It is
# idempotent: anything that already exists is reported and left alone, so
# re-running after a partial failure is safe.
#
#   bash setup-alerts.sh              # create what is missing
#   DRY_RUN=1 bash setup-alerts.sh    # print the plan, change nothing
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-bike-eco-43a84}"
ALERT_EMAIL="${ALERT_EMAIL:-rnoyer.dev+bikeeco@gmail.com}"
DRY_RUN="${DRY_RUN:-0}"

CHANNEL_TITLE="Bike-eco - alertes techniques"
POLICY_B2C="Bike-eco - erreur formulaire public B2C"
POLICY_FUNCTIONS="Bike-eco - erreur fonction"

# Every deployed function, 2nd gen, runs on Cloud Run. This pair of clauses is
# what `firebase functions:log` itself uses to mean "our functions" — verified
# against the live log stream rather than assumed.
BASE_FILTER='resource.type="cloud_run_revision" AND labels."goog-managed-by"="cloudfunctions"'

# Cloud Run lowercases service names, so this is `sendB2cSubmission`.
B2C_FUNCTION="sendb2csubmission"

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
skip() { printf '  déjà en place — ignoré : %s\n' "$*"; }
made() { printf '  créé : %s\n' "$*"; }

if [ "$DRY_RUN" = "1" ]; then
  say "SIMULATION — aucune ressource ne sera créée"
fi

say "Projet : $PROJECT_ID"
say "Adresse alertée : $ALERT_EMAIL"

# ─── 0. API ──────────────────────────────────────────────────────────────────
# Idempotent, and a no-op when already enabled.
say "1/4 — API Monitoring"
if [ "$DRY_RUN" = "1" ]; then
  echo "  activerait monitoring.googleapis.com"
else
  gcloud services enable monitoring.googleapis.com --project="$PROJECT_ID"
  echo "  monitoring.googleapis.com actif"
fi

# ─── 1. notification channel ─────────────────────────────────────────────────
say "2/4 — Canal de notification"
CHANNEL="$(gcloud beta monitoring channels list \
  --project="$PROJECT_ID" \
  --filter="displayName='${CHANNEL_TITLE}'" \
  --format='value(name)' | head -1)"

if [ -n "$CHANNEL" ]; then
  skip "$CHANNEL_TITLE"
elif [ "$DRY_RUN" = "1" ]; then
  echo "  créerait le canal email vers $ALERT_EMAIL"
  CHANNEL="projects/$PROJECT_ID/notificationChannels/SIMULATION"
else
  CHANNEL="$(gcloud beta monitoring channels create \
    --project="$PROJECT_ID" \
    --display-name="$CHANNEL_TITLE" \
    --description="Alertes techniques Bike-eco (fonctions Cloud)" \
    --type=email \
    --channel-labels="email_address=${ALERT_EMAIL}" \
    --format='value(name)')"
  made "$CHANNEL"
fi

echo "  canal : $CHANNEL"

# ─── 2. policies ─────────────────────────────────────────────────────────────
#
# Both policies match on **severity and which function**, never on the text of a
# log message. A message string is edited sooner or later, and an alert keyed to
# one fails silently and forever when that happens — the exact failure mode this
# whole change exists to remove.
#
# `notificationRateLimit` is required by the API for a LogMatch condition, and
# `combiner: OR` with exactly one condition is the only shape such a policy
# accepts.

create_policy() {
  local title="$1" filter="$2" rate="$3" doc="$4" file="$WORKDIR/policy.json"

  local existing
  existing="$(gcloud monitoring policies list \
    --project="$PROJECT_ID" \
    --filter="displayName='${title}'" \
    --format='value(name)' | head -1)"

  if [ -n "$existing" ]; then
    skip "$title"
    return 0
  fi

  # Built by python3 rather than by a shell heredoc of raw JSON: every value
  # here (the filter, the documentation) contains quotes, newlines or both, and
  # hand-escaping those into JSON is what breaks on the one input nobody tried.
  # The values arrive as environment variables so the shell never has to quote
  # them into the Python source either.
  P_TITLE="$title" P_FILTER="$filter" P_DOC="$doc" P_RATE="$rate" P_CHANNEL="$CHANNEL" \
    python3 > "$file" <<'PY'
import json, os

policy = {
    "displayName": os.environ["P_TITLE"],
    "combiner": "OR",
    "enabled": True,
    "documentation": {
        "content": os.environ["P_DOC"],
        "mimeType": "text/markdown",
    },
    "conditions": [{
        "displayName": "Entree de journal en erreur",
        "conditionMatchedLog": {
            "filter": os.environ["P_FILTER"],
            # Surfaced in the notification email via ${log.extracted_label.<key>}.
            "labelExtractors": {
                "fonction": 'EXTRACT(labels."goog-drz-cloudfunctions-id")',
                "utilisateur": "EXTRACT(jsonPayload.uid)",
            },
        },
    }],
    "alertStrategy": {
        # Required by the API for a LogMatch condition.
        "notificationRateLimit": {"period": os.environ["P_RATE"]},
        "autoClose": "3600s",
    },
    "notificationChannels": [os.environ["P_CHANNEL"]],
}
print(json.dumps(policy, ensure_ascii=False, indent=2))
PY

  if [ "$DRY_RUN" = "1" ]; then
    echo "  créerait la règle « $title » :"
    sed 's/^/    /' "$file"
    return 0
  fi

  gcloud monitoring policies create --project="$PROJECT_ID" --policy-from-file="$file" >/dev/null
  made "$title"
}

say "3/4 — Règle : échec du formulaire public B2C"
create_policy \
  "$POLICY_B2C" \
  "${BASE_FILTER} AND severity>=ERROR AND labels.\"goog-drz-cloudfunctions-id\"=\"${B2C_FUNCTION}\"" \
  "300s" \
  'Le formulaire public B2C a échoué sur ${project}.

Chaque échec est une demande client perdue : rien n'\''est enregistré en base, l'\''email est le seul livrable.

Fonction : ${log.extracted_label.fonction}

Marche à suivre : docs/ops/monitoring-alertes.md'

say "4/4 — Règle : erreur dans une autre fonction"
create_policy \
  "$POLICY_FUNCTIONS" \
  "${BASE_FILTER} AND severity>=ERROR AND NOT labels.\"goog-drz-cloudfunctions-id\"=\"${B2C_FUNCTION}\"" \
  "1800s" \
  'Une fonction Cloud a échoué sur ${project}.

Fonction : ${log.extracted_label.fonction}
Utilisateur concerné : ${log.extracted_label.utilisateur}

Marche à suivre : docs/ops/monitoring-alertes.md'

say "Terminé."

# A channel whose verificationStatus is UNVERIFIED delivers nothing at all, so
# this is the one post-condition worth printing rather than assuming.
if [ "$DRY_RUN" != "1" ]; then
  say "État du canal"
  gcloud beta monitoring channels describe "$CHANNEL" \
    --project="$PROJECT_ID" \
    --format='value(verificationStatus)' || true
fi

cat <<'DONE'

Vérifier dans la console :
  Monitoring > Alerting > Policies                    (deux règles)
  Monitoring > Alerting > Edit notification channels  (un canal email)

Si l'état du canal affiché ci-dessus est UNVERIFIED, le canal ne délivre RIEN :
il faut le vérifier (Monitoring > Alerting > Edit notification channels, puis
l'action de vérification sur la ligne du canal). VERIFIED, ou un état vide,
signifie qu'il fonctionne.

Cloud Monitoring ne propose pas d'envoi de notification de test pour un canal
email. Pour prouver la chaîne de bout en bout, voir la section « Vérifier que
l'alerte fonctionne vraiment » de docs/ops/monitoring-alertes.md.
DONE
