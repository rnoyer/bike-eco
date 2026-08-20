# Update personal information form specifications

The one-step form behind each pencil button of "Mes informations personnelles" on
[Mon compte](page-my-account.md). It edits **one** field at a time — whichever row's
button was tapped.

Route: `(b2b)/edit-profile` and `(backoffice)/edit-profile`, both thin wrappers around the
shared `EditProfileFieldScreen`. Which field is edited is the `?field=` search param
(`nom` | `prenom` | `telephone`); anything else — `email` included — renders
"Information non modifiable." rather than a form.

## Navbar props

- Left : back arrow
- Middle : "Modifier mon nom" / "Modifier mon prénom" / "Modifier mon téléphone"
- Right : none

## Main section

One input, prefilled with the field's current value, then the two buttons.

| Field | label | placeholder | validation |
|---|---|---|---|
| `nom` | "Nom \*" | "Votre nom" | trimmed, non-empty — "Saisissez votre nom" |
| `prenom` | "Prénom \*" | "Votre prénom" | trimmed, non-empty — "Saisissez votre prénom" |
| `telephone` | "Téléphone \*" | "Votre numéro de téléphone" | exactly 10 digits (non-digits stripped on input) — "Saisissez un numéro à 10 chiffres" |

The copy and the rules are the registration form's, verbatim: the same field, so the same
contract. Below the input, the usual note "\* Champs obligatoires".

Buttons, in order:

- **"Annuler"** (primary) — closes the form and returns to the "Mon compte" tab. Nothing
  is written.
- **"Mettre à jour"** (outlined — this app's `Button` has no `secondary` variant) — holds
  the spinner while the update is in flight, and blocks a second tap.

On success the screen becomes the [confirmation page](page-confirmation.md) — green tick,
"Mis à jour" / "Vos informations ont bien été mises à jour." — and after 1500 ms redirects
to the "Mon compte" tab. It is rendered in place rather than pushed as a route: the
`(b2b)` confirmation route carries the invitation flow's fixed copy.

On failure the mapped French message is shown in a "Modification impossible" dialog and
the form stays put with the typed value.

## What the update writes

`updateMyProfile` (`functions/src/users/`), not a client write: the same values are
denormalized elsewhere, and no client may write those copies.

| Document | Field | When |
|---|---|---|
| `users/{uid}` | `nom` / `prenom` / `telephone` + `updatedAt` | always |
| `dossiers/{id}` where `submittedBy == uid` | `submitter.nom` / `.prenom` / `.telephone` | always, in batches of 400 |
| `companies/{companyId}` | `createdByName` = "prénom nom" | only when a **name** changed **and** the caller is the company's `createdBy` |

- **Only fields that genuinely differ are written.** Re-submitting an unchanged value
  writes nothing at all rather than fanning out over every dossier the user has filed.
- The dossier writes leave `updatedAt` and `updatedBy` alone: correcting your own name is
  not a change *to the dossier*, and `updatedBy` is what the notification trigger reads to
  decide whom to skip. (`onDossierUpdated` only emits on a `status` / `validatedPrice`
  change, so these writes fire it and send nothing.)
- **Message `senderName` is never rewritten.** A chat line records who wrote it at the
  time, under the name and company they had then.
- No `status` guard: a colleague still waiting on the company's validation can fix a
  mistyped phone number.

Afterwards the client refreshes the session (`refreshSession`) — `AuthProvider` reads the
profile with `getDoc`, not a live listener, so without it "Mon compte" would come back
showing the replaced value.
