# B2B and Back-office My-account page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Mon Compte"
- right : None

## Main section

From top to bottom

- [`InfoCard`](component-info-card.md) "Mes informations personnelles" : one part
  (liste d'information) — Nom / Prénom / Email / Téléphone. Email and téléphone are plain
  rows here, **without** the call / mail action buttons used elsewhere: this is the
  viewer's own contact information.
- `InfoCard` "Informations [nom entreprise]" (B2B only, i.e. the user has a `companyId`;
  hidden for back-office users) : one part (liste d'information) — SIRET / Département /
  Ville.
- Section "Actions sur mon compte" :
  - "Se déconnecter" (primary).
  - "Changer mon mot de passe" (outlined) — **hidden** for an account with no password credential
    (signed up with Google only), which has no password to reset. Tapping it asks to confirm
    ("Un lien de réinitialisation va être envoyé à [email]. Continuer ?" — Annuler / Envoyer), then
    triggers Firebase's password-reset workflow (`sendPasswordResetEmail` on the account's email).
    The emailed link opens Firebase's hosted "new password" page; the app has no reset screen.
    Success : "Email envoyé — Un lien de réinitialisation vient d'être envoyé à [email]. Vérifiez
    votre boîte de réception." Failure : the message from `mapPasswordResetError`.
- "Supprimer mon compte" (danger) — pinned to the bottom of the screen, below the sections,
  and pushed down to the bottom edge when the content is shorter than the viewport. Tapping
  it opens a confirmation modal — "Supprimer mon compte ?" / "Cette action supprime
  définitivement votre compte. Vos dossiers et vos conversations sont conservés." /
  "Annuler" / "Supprimer mon compte" — then deletes the account and signs the user out.
  **Disabled for an administrator**, with the line "Un administrateur ne peut pas
  supprimer son compte. Transférez d'abord le rôle administrateur à un collaborateur."
  below the button.

## Loading and error states

While the account and company reads are in flight the page shows a centered
spinner — never a blank view. If a read fails it shows the mapped French error;
if the account itself is absent, "Compte introuvable.". The company card carries
its own loading / error / "Entreprise introuvable." states inside its body,
independently of the personal-information card.

## Tab bar props

### B2B

From left to right :

- "Dashboard" : store icon, link to: dashboard page (current)
- "Mon compte" : user icon, link to: my-b2b-account page
- "Paramètres" : gear icon, link to: b2b-settings page

### Bike-eco Backoffice

From left to right :

- "Dashboard" : store icon, link to: dashboard page (current)
- "Mon compte" : user icon, link to: my-bo-account page
- "Paramètres" : gear icon, link to: bo-settings page
