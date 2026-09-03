# B2C submission email function

The public (non-logged-in) B2C funnel is **email-only**: on submit, a Cloud
Function validates the form, sends two emails, and persists nothing. This
document describes the implemented function, its request contract, and its
operational settings. The authoritative code lives in `functions/src/`; keep
this document in sync when that code changes.

Related: [Firestore data model](./firestore-data-model.md) (why B2C has no write
path), and the funnel spec `docs/specs/form-b2c-vehicule-submission.md`.

## Key decisions

- **Nothing is persisted.** No Firestore, no Cloud Storage. The photos are
  streamed straight into the team email as attachments and discarded.
- **Image delivery = `onRequest` + multipart/form-data.** The client posts the
  form (minus photos) as a JSON field plus N photo files. The function parses the
  stream with busboy and attaches the photo buffers. Chosen over a callable +
  temp Storage approach because it needs no auth, no Storage rules, and no
  cleanup — the public funnel is unauthenticated.
- **Two emails per submission:**
  - **Team notification** → NORTH or SOUTH mailbox by `departement`, with **all**
    form fields and the **photos attached**. Sent first (operationally critical).
  - **Customer recap** → the submitter, with a summary of relevant fields, no
    attachments.
- **Dev override.** When `DEV_EMAIL_OVERRIDE` is flipped to `true` (it is `false` today), both emails route to
  `rnoyer.dev@gmail.com` regardless of region (per the product spec).
- **Transport = Nodemailer + SMTP**, pooled and reused across invocations. When
  SMTP secrets are absent (e.g. the local emulator) it falls back to a JSON
  transport that **logs** the composed message instead of sending — the full flow
  is testable offline.

## Files

| File                                    | Responsibility                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `functions/src/index.ts`                | `sendB2cSubmission` HTTP handler: multipart parsing, validation, status codes, send orchestration |
| `functions/src/email.ts`                | Pooled transport, recipient routing, customer + team HTML builders, secret definitions            |
| `functions/src/payload.ts`              | Zod schema mirroring the funnel payload (server-side validation; photos excluded)                 |
| `functions/src/regions.ts`              | NORTH/SOUTH département mapping — duplicated from `src/constants/departments.ts` (keep in sync)   |
| `src/features/b2c-submission/submit.ts` | Client: builds the `FormData`, resolves the endpoint URL, posts, throws French errors             |
| `src/app/b2cSubmissionForm.tsx`         | Funnel screen: calls `submitB2cSubmission` on submit, alerts on failure, guards double-send       |

## Request contract

`POST sendB2cSubmission` — `Content-Type: multipart/form-data`

| Part      | Type                | Notes                                                                           |
| --------- | ------------------- | ------------------------------------------------------------------------------- |
| `payload` | field (JSON string) | The funnel form minus `photos`. Validated by `b2cPayloadSchema`.                |
| `photos`  | file × N            | Image attachments. `image/*` only; non-images are dropped. At least 1 required. |

### Responses

| Status          | When                                                                         |
| --------------- | ---------------------------------------------------------------------------- |
| `200 {ok:true}` | Both emails sent (or logged in dev).                                         |
| `400`           | Not multipart, bad `payload` JSON, failed schema validation, or zero photos. |
| `405`           | Method other than POST.                                                      |
| `413`           | A photo exceeds 8 MB, or more than 12 photos.                                |
| `502`           | Email transport failed (not auto-retried — surfaced to the client).          |

Error bodies are `{ "error": "<message in French>" }` for client display.

## Concurrency & limits

Image buffers are held in memory, so the endpoint is tuned to bound per-instance
memory while letting autoscaling absorb bursts:

| Setting            | Value         | Why                                                        |
| ------------------ | ------------- | ---------------------------------------------------------- |
| `memory`           | `512MiB`      | Headroom for concurrent in-flight image buffers            |
| `concurrency`      | `15`          | Caps simultaneous requests per instance (memory safety)    |
| `maxInstances`     | `10` (global) | Bounds the autoscaling blast radius                        |
| busboy `fileSize`  | `8 MB`        | Rejects oversized photos instead of buffering them (`413`) |
| busboy `files`     | `12`          | Max photos per submission (`413`)                          |
| busboy `fieldSize` | `100 KB`      | The JSON payload is a few KB                               |

Because nothing is persisted, concurrent submissions share no mutable state — no
transactions, no races. The transport is created once at module scope with
`pool: true, maxConnections: 5` so concurrent requests reuse a bounded SMTP pool.
There is no server-side dedupe; the client disables the submit button in-flight
to avoid double-sends.

## Email routing

`resolveRegion(departement)` maps the `"13 - Bouches-du-Rhône"` style label to
`NORTH` (Montargis centre) or `SOUTH` (Vitrolles centre), defaulting to `NORTH`
for unknown values so a submission is never dropped.

| Recipient | Dev (`DEV_EMAIL_OVERRIDE = true`, not the default) | Production                                  |
| --------- | -------------------------------------------------- | ------------------------------------------- |
| Team      | `rnoyer.dev@gmail.com`                             | `NORTH_MAILBOX` / `SOUTH_MAILBOX` by region |
| Customer  | `rnoyer.dev@gmail.com`                             | the submitter's `email`                     |

## Client endpoint resolution

`functionUrl()` in `submit.ts` picks, in order:

1. `EXPO_PUBLIC_FUNCTIONS_URL` (base up to but excluding the function name) — set
   this to reach the emulator from a physical device over the LAN, e.g.
   `http://192.168.1.x:5001/bike-eco-43a84/europe-west9`.
2. Dev default: `http://localhost:5001/bike-eco-43a84/europe-west9/sendB2cSubmission`.
3. Production: `https://europe-west9-bike-eco-43a84.cloudfunctions.net/sendB2cSubmission`.

## Local testing

The functions emulator runs `sendB2cSubmission` on port `5001`. With no SMTP
secrets set, emails are logged (JSON transport) rather than sent. Example:

```bash
URL="http://127.0.0.1:5001/bike-eco-43a84/europe-west9/sendB2cSubmission"
curl -X POST "$URL" \
  -F "payload=<payload.json;type=application/json" \
  -F "photos=@photo.png;type=image/png"
# → {"ok":true}; the emulator log shows both composed emails,
#   team subject "Nouvelle demande B2C — SOUTH — …" with photo.png attached.
```

Verified cases: valid submission (correct region + attachment), missing photo
(`400`), invalid payload (`400`), non-image file dropped (`400`), `GET` (`405`).

## Go-live checklist

1. **SMTP secrets** — `firebase functions:secrets:set SMTP_HOST` (and
   `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`). For the emulator, put them in
   `functions/.secret.local`. Until set, emails are logged, not sent.
2. **Real mailboxes** — `DEV_EMAIL_OVERRIDE` is already `false`, but
   `NORTH_MAILBOX` / `SOUTH_MAILBOX` in `email.ts` are both still the dev
   address, so `resolveRegion` routing has no observable effect yet. Fill them
   (and `FROM_ADDRESS`) with the real mailboxes.
3. **App Check** — enforce it on this public endpoint as the abuse guard.

## Tooling

The `firebase deploy` **predeploy** hook runs `npm run lint` then `npm run build`
in `functions/`; both pass.

- **Lint** — the functions package uses **ESLint v9 flat config**
  (`functions/eslint.config.js`, `@eslint/js` + `typescript-eslint`), aligned with
  the surrounding Expo project's v9 toolchain so a bare `eslint` resolves
  consistently regardless of cwd/PATH. The script is `eslint .`. Linting is
  non-type-aware (fast, no tsconfig project); types are enforced separately by
  `tsc`. The previous ESLint v8 setup (`.eslintrc.js`, `eslint --ext`,
  `eslint-config-google`) was removed because the v8 `--ext` flag was rejected by
  the v9 ESLint that shadows it on PATH in this repo.
- **Build** — `tsc` compiles `src/` → `lib/` (`main: lib/index.js`). `lib/` is
  gitignored, so a fresh clone or CI must build before the emulator can load the
  functions.
