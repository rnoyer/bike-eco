# Dossier recap email — design

**Date:** 2026-08-11
**Status:** approved, not yet implemented

## Goal

A back-office user reading a dossier can mail themselves the whole thing. One
button at the bottom of the dossier detail screen, `M'envoyer par email`, sends
a recap of the dossier to the address on their own account.

Back-office only for now. B2B users see no button; the callable rejects them.

## Flow

1. Back-office user taps `M'envoyer par email` on `/(backoffice)/dossier/{id}`.
2. The button spins while the client calls `sendDossierRecap` with `{ dossierId }`.
3. The function re-reads the dossier from Firestore, resolves the caller's own
   email, renders the HTML, sends it, and acknowledges.
4. The client redirects to the back-office confirmation screen —
   "Récapitulatif envoyé à votre adresse email" — which auto-redirects back to
   the dossier after 1500 ms.

The client sends nothing but the dossier id. Every value in the email is read
server-side under the function's own credentials, and the recipient is derived
from the verified token's uid — never from the payload. A caller cannot mail a
dossier to somebody else, or mail themselves a dossier they doctored.

## Server

### New module `functions/src/dossierEmail/`

Mirrors `functions/src/users/`: schema, dependency-injected core, thin wiring.

- `schemas.ts` — `dossierRecapSchema = z.object({ dossierId: z.string().min(1) })`.
- `core.ts` — `sendDossierRecapCore(input, caller, deps)`:
  1. `caller.role !== "backoffice"` → `RegError("permission-denied", "Action non autorisée.")`.
  2. `deps.getDossier(dossierId)` → `null` → `RegError("not-found", "Dossier introuvable.")`.
  3. `deps.getUserEmail(caller.uid)` → missing/empty →
     `RegError("failed-precondition", "Aucune adresse email n'est associée à votre compte.")`.
  4. `deps.sendMail({ to, subject, html })` with the rendered document.

  Returns nothing — `authedCall`'s `respond` turns that into the `{ ok: true }`
  acknowledgement the client's `call()` expects. The address never leaves the
  server: the confirmation screen says "votre adresse email" rather than naming
  a mailbox, so there is nothing for the callable to hand back.
- `render.ts` — `recapSubject(dossier)` and `recapHtml(dossier)`. Pure functions
  over the dossier document; no I/O, no Firebase imports.
- `index.ts` — builds the real deps (admin SDK reads, `sendHtmlMail`) and
  exports `sendDossierRecap = authedCall(recapSchema, …, { secrets: B2C_EMAIL_SECRETS })`.

Re-exported from `functions/src/index.ts` alongside the other callables.

### Email plumbing

`functions/src/email.ts` currently keeps its HTML helpers private and exposes
only `sendMail` (plain text) and `sendB2cEmails`. Two targeted changes:

- Extract `esc`, `rowsHtml`, `section`, `shell` and the `Row` type into a new
  `functions/src/emailHtml.ts`, imported by both `email.ts` and the new
  renderer. The B2C emails must keep rendering byte-identically — this is a
  move, not a rewrite.
- Add `sendHtmlMail({ to, subject, html })` to `email.ts`, honouring
  `DEV_EMAIL_OVERRIDE` exactly as `sendMail` does, and reusing the same pooled
  transport.

### Formatting on the server

`functions/` is a separate package and cannot import `src/lib/ui/format.ts`, so
`render.ts` carries its own small set of formatters: dash-for-absent, `euros`,
`kilometres`, oui/non, the dossier status labels, the région labels, and the
submission date.

Dates render with `timeZone: "Europe/Paris"`. Cloud Functions run in UTC, so
without it a dossier submitted at 00:30 Paris time would be dated the previous
day in the email while the app shows it correctly.

The status is printed raw (`À traiter` / `En cours` / `Clôturé`). The `viewerStatus`
projection that hides `a_traiter` from B2B users does not apply: the reader is
always the back office.

### Email content

Subject, also used as the `<h1>`:

```
Demande de rachat - {submitter.companyName} - {vehicle.marque} {vehicle.modele}
```

Intro line, in the `shell`'s subtitle slot:

```
Veuillez trouver le récapitulatif de la demande de rachat soumise dans
l'application Bike-eco par {submitter.prenom} {submitter.nom}, de
{submitter.companyName}.
```

Then three sections, in the order the back office reads the dossier screen.
Rows with no value are dropped, which is what `rowsHtml` already does for the
B2C emails — the recap stays visually one family with them.

**Informations véhicule** — every row the dossier page renders, with the
collapsibles flattened into plain rows:

| Row | Source |
|---|---|
| Prix souhaité | `pricing.prix` € |
| Marque | `vehicle.marque` |
| Modèle et Cylindrée | `vehicle.modele` |
| Année | `vehicle.annee` |
| Kilométrage | `vehicle.kilometrage` km |
| Électrique | `vehicle.electrique` |
| Batterie présente | only when électrique = oui, from `vehicle.materiel` |
| Chargeur présent | only when électrique = oui, from `vehicle.materiel` |
| État | `condition.etat` |
| Nature de la panne | only when `condition.etat === "En Panne"` |
| Carte grise | `papers.carteGrise` |
| À votre nom | only when carte grise = oui |
| Contrôle technique | `papers.controleTechnique` |
| Moins de 6 mois | only when CT = oui |
| Résultat obtenu | only when CT = oui |
| Certificat de non-gage | `papers.certificatNonGage` |
| Carnet d'entretien | `papers.carnetEntretien` |
| Facture d'entretien | `papers.factureEntretien` |
| Clés de contact | `keys.aClesContact` |
| Clé noire / marron / rouge | only when clés = oui |
| Télécommande ou Bip | `keys.aTelecommande` |
| Nombre | only when télécommande = oui |
| Commentaires véhicule | `vehicle.accessoires` |
| Commentaires complémentaires | `pricing.commentaires` |

**Informations vendeur** — entreprise, nom, prénom, téléphone, email, all from
the denormalized `submitter` (a deleted colleague's `users/{uid}` doc is gone
while their dossiers remain).

**Informations Dossier** — date de soumission, statut, prix validé, région.

No photos and no photo links. The recap is text.

## Client

### `src/lib/data/useDossierRecapEmail.ts`

A `useAsyncAction` wrapper over `call<{ dossierId: string }, { ok: true }>("sendDossierRecap", …)`,
exposing `{ sendRecap, pending }` — the same shape as `useDossierManagement`.
Errors already arrive in French from `frenchError`.

### `DossierDetailScreen`

When `role === "backoffice"`, render at the bottom of the `SectionWrapper`,
below the Dossier card:

```tsx
<Button label="M'envoyer par email" loading={pending} onPress={…} />
```

`loading`, not `disabled` — a network round-trip should read as working, not
unavailable. On failure, `alertDialog("Envoi impossible", message)`, as the
management screen does. On success, redirect to the confirmation screen.

The B2B screen renders no button at all, so the back-office-only rule is
enforced in two places: the UI never offers it, and the callable refuses it.

### `(backoffice)/confirmation.tsx`

Today the screen hardcodes the management flow's copy. It gains three optional
search params — `title`, `message`, `redirectTo` — defaulting to exactly the
current values, so `DossierManagementForm`'s `router.replace("/(backoffice)/confirmation")`
keeps working untouched.

The recap flow navigates with:

- `title`: `Récapitulatif envoyé`
- `message`: `Récapitulatif envoyé à votre adresse email`
- `redirectTo`: `/(backoffice)/dossier/{id}`

and the existing 1500 ms delay.

## Error handling

| Situation | Behaviour |
|---|---|
| Caller is not back-office | `permission-denied`, "Action non autorisée." |
| Dossier missing | `not-found`, "Dossier introuvable." |
| No email on the account | `failed-precondition`, French message |
| SMTP failure | `toHttps` logs it and returns the generic internal error |
| Any of the above, client side | `alertDialog`; the button stops spinning and the user stays on the dossier |

Nothing is persisted and nothing is retried. A failed send leaves no trace to
clean up, and the user can simply press the button again.

## Testing

- `functions/src/dossierEmail/core.test.ts` — fake deps: a B2B caller is
  rejected without any send; a missing dossier is rejected; the happy path
  sends to the caller's own address.
- `functions/src/dossierEmail/render.test.ts` — the subject carries company and
  vehicle; the three section titles are present; a conditional row appears only
  when its parent answer is oui; an absent field produces no row.
- No new security rules: the function reads through the admin SDK, and the
  client writes nothing.

Gated by the standard `tsc` + lint + test command in `docs/tech/verification.md`.

## Docs to update in the same change

- `docs/specs/page-dossier.md` — the back-office-only button.
- `docs/specs/page-confirmation.md` — the optional title/message/redirect params.

## Explicitly out of scope

- B2B users sending themselves a recap.
- Sending to an address other than the caller's own.
- Photos, attached or linked.
- Rate limiting: the callable is back-office-only and can only ever mail the
  caller's own mailbox.
