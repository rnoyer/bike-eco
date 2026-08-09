# B2C submission — local test guide

How to exercise the `sendB2cSubmission` Cloud Function end-to-end against the
Firebase emulator and actually deliver both emails to a real inbox
(`romain.noyer@gmail.com` during development).

For the function's design and request contract, see
[b2c-submission-email.md](./b2c-submission-email.md).

## What you'll verify

A single submission produces **two emails**, both routed to
`romain.noyer@gmail.com` when `DEV_EMAIL_OVERRIDE` is flipped to `true` (it is `false` today):

1. **Team notification** — _Nouvelle demande B2C — SOUTH — Jean Dupont_, all form
   fields, with the photo(s) **attached**.
2. **Customer recap** — _Bike-eco — votre demande a bien été reçue_, summary
   only, no attachment.

Both are sent **from** the authenticated SMTP account (`Bike-eco <SMTP_USER>`).

> Without SMTP secrets the function still returns `200` but only **logs** the
> emails (JSON transport) instead of sending them. To deliver to a real inbox you
> must complete the SMTP setup below.

## 1. Provide SMTP credentials

The emulator reads secret values from `functions/.secret.local` (dotenv format).
This file is gitignored (`*.local`) — never commit it.

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=romain.noyer@gmail.com
SMTP_PASS=<your provider password / app password>
```

Pick one provider:

### Option A — Gmail (delivers to the real inbox)

Gmail SMTP rejects your normal password; create an **App Password** (requires
2-Step Verification):

1. Enable 2-Step Verification:
   <https://myaccount.google.com/signinoptions/two-step-verification>
2. Create an App Password (name it `bike-eco`):
   <https://myaccount.google.com/apppasswords>
3. Paste the 16-character value (drop the spaces) into `SMTP_PASS`.

Use `smtp.gmail.com` / `587`. You are sending from your own account to your own
account — that is expected. Check the spam folder if a message is missing.

### Option B — Mailtrap (fake inbox, no real delivery, no app password)

Best when you only want to inspect the rendered emails. From a Mailtrap "Email
Testing" inbox, copy the SMTP credentials:

```
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=<mailtrap user>
SMTP_PASS=<mailtrap pass>
```

Emails appear in the Mailtrap inbox (with attachments), never in a real mailbox.

### Option C — Brevo / Mailgun (real delivery, transactional)

Any transactional SMTP works — swap in that provider's host/port/user/pass.

## 2. Build and restart the emulator

Secrets are read **only at startup**, and the emulator serves the compiled
`lib/`, so rebuild and (re)start:

```bash
cd functions
npm run build
firebase emulators:start --only functions
```

Wait for:

```
✔  functions[us-central1-sendB2cSubmission]: http function initialized
   (http://127.0.0.1:5001/bike-eco-43a84/us-central1/sendB2cSubmission).
```

If you see the warning `SMTP secrets not set — using JSON transport`, the
secrets were not picked up — recheck `functions/.secret.local` and restart.

## 3. Trigger a submission

Send one full submission (dépt 13 → SOUTH, with a 1×1 test PNG). Run from a
shell — or paste into this session with the `!` prefix:

```bash
cd "$(mktemp -d)"
# minimal 1x1 PNG
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > p.png
cat > pl.json <<'JSON'
{"nom":"Dupont","prenom":"Jean","email":"jean@example.com","telephone":"0612345678","departement":"13 - Bouches-du-Rhône","ville":"Marseille","electrique":"non","materiel":[],"marque":"Honda","modele":"CB500","cylindree":"500","annee":"2018","kilometrage":"24000","accessoires":"top case","etat":"Bon état","prix":"3500","commentaires":"Bien entretenue","modalite":"Je dépose la moto au centre de Vitrolles","carteGrise":"oui","controleTechnique":"oui","resultatCT":"Favorable"}
JSON
curl -s -w "\nHTTP %{http_code}\n" \
  -X POST "http://127.0.0.1:5001/bike-eco-43a84/us-central1/sendB2cSubmission" \
  -F "payload=<pl.json;type=application/json" \
  -F "photos=@p.png;type=image/png"
```

To test **NORTH** routing, change `departement` to e.g. `"75 - Paris"` and
`modalite` to `"Je dépose la moto au centre de Montargis"` — the team subject
becomes `… — NORTH — …`. Add more `-F "photos=@<file>;type=image/jpeg"` parts to
attach several photos.

## 4. Expected result

- Response: `{"ok":true}` and `HTTP 200`.
- Two emails in the inbox (team notification with attachment + customer recap).
- The emulator log shows **no** "JSON transport" warning when SMTP is configured.

## 5. Testing through the app (optional)

The funnel screen (`src/app/b2cSubmissionForm.tsx`) posts to the same endpoint
via `submitB2cSubmission`. On a simulator/web, `localhost:5001` resolves to the
emulator automatically. On a **physical device**, point the app at your
machine's LAN IP with an env var before `expo start`:

```bash
EXPO_PUBLIC_FUNCTIONS_URL=http://192.168.1.x:5001/bike-eco-43a84/us-central1 npx expo start
```

Complete the funnel (a real photo is required at step 7) and submit; the success
screen appears on `200`, otherwise an alert shows the error message.

## Troubleshooting

| Symptom                                                     | Cause / fix                                                                                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Emulator log: `SMTP secrets not set — using JSON transport` | `.secret.local` missing/empty or emulator not restarted after editing it.                                                           |
| `HTTP 502 {"error":"Échec de l'envoi des emails."}`         | SMTP auth/connection failed. Gmail: use an **App Password**, not your login password. Check emulator logs for the nodemailer error. |
| `HTTP 400 "Au moins une photo est requise."`                | No `photos` part, or the file wasn't `image/*` (non-images are dropped).                                                            |
| `HTTP 400 "Données du formulaire invalides."`               | `payload` failed schema validation (e.g. bad email, phone ≠ 10 digits, empty required field).                                       |
| `HTTP 413`                                                  | A photo exceeds 8 MB, or more than 12 photos.                                                                                       |
| `curl` connection refused (`HTTP 000`)                      | Emulator not running, or wrong port. Confirm it's serving on `5001`.                                                                |
| Email not in inbox (Gmail)                                  | Check the spam folder; first self-sent message can be flagged.                                                                      |

### Resolving SMTP credentials issues

After editing .secret.local, restart the emulator — secrets are only read at startup (per the test guide):

cd functions && firebase emulators:start --only functions
