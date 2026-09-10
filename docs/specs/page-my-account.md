# B2B and Back-office My-account page specifications

## Navbar props

- Left : Left arrow icon linked to page-dashboard
- middle : "Mon Compte"
- right : None

## Main section

From top to bottom

- [`InfoCard`](component-info-card.md) "Mes informations personnelles" : **four parts**,
  one per field, so each carries the card's hairline above and below it —
  Nom / Prénom / Email / Téléphone. Email and téléphone are plain rows here,
  **without** the call / mail action buttons used elsewhere: this is the viewer's own
  contact information.
  - Nom, Prénom and Téléphone are [`InfoEditableRow`](component-info-card.md)s: each
    carries a pencil button opening
    [the update form](form-update-personal-information.md) for that field.
  - **Email is a plain `InfoRows`, with no pencil.** It is the account's sign-in
    credential, not a profile field — changing it is an auth flow, not a profile write.
- `InfoCard` "Informations [nom entreprise]" (B2B only, i.e. the user has a `companyId`;
  hidden for back-office users) : one part (liste d'information) — SIRET / N° TVA /
  Département / Ville. `N° TVA` is optional at registration and renders `"—"` when absent.
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
  and pushed down to the bottom edge when the content is shorter than the viewport. That edge
  is the top of the tab bar, not the bottom of the screen: iOS draws the bar as translucent
  glass over the content, so the screen reserves `useTabBarInset()` at its bottom to keep the
  button clear of it.

  Tapping it always opens a modal titled **"Supprimer mon compte ?"**, with "Annuler"
  (primary) as its first button — which only dismisses, leaving the user on this page. What
  the second button says and does depends on what the organisation still needs from this
  account. The decision is `deleteAccountPrompt` (`src/features/profile/`), read from the
  live "Mes collaborateurs" list, and **"dernier membre" wins over "dernier
  administrateur"** — the latter has no way out once you are alone.

  **B2B**

  | Situation | Message | Second button |
  |---|---|---|
  | Dernier membre de l'entreprise | "En supprimant votre compte, vous supprimez également toutes les données relatives à l'entreprise [nom] et aux dossiers que vous avez soumis.<br>Êtes-vous sur de vouloir supprimer votre compte et l'entreprise ?" | "Supprimer mon compte" (danger) — supprime le compte **et l'entreprise**, puis renvoie à l'écran d'accueil de l'application |
  | Dernier administrateur, mais il reste des vendeurs | "Vous êtes le dernier administrateur de l'entreprise [nom]. Veuillez attribuer le rôle Administrateur à un autre vendeur avant de supprimer votre compte" | "Gérer mes collaborateurs" (secondaire) — ouvre l'onglet "Paramètres". Rien n'est supprimé |
  | Sinon | "Cette action supprime définitivement votre compte. Vos dossiers et vos conversations sont conservés." | "Supprimer mon compte" (danger) — supprime le compte et déconnecte |

  The "dernier membre" cascade is the same one as the back office's "Supprimer
  l'entreprise" (`companies/cascade.ts`): fichiers → dossiers → comptes → invitations →
  entreprise. No orphan is left. It also covers a lone **vendeur** — an admin-less company
  of one still leaves nothing behind.

  **Bike-eco back office**

  | Situation | Message | Second button |
  |---|---|---|
  | Dernier membre de Bike-eco | "Vous êtes le dernier membre de Bike-eco. Afin de supprimer votre compte, veuillez d'abord inviter un nouveau membre d'équipe Bike-eco, et le promouvoir comme administrateur." | "Inviter un membre" (secondaire) — ouvre l'onglet "Paramètres". Rien n'est supprimé |
  | Dernier administrateur, mais il reste des membres | "Vous êtes le dernier administrateur de Bike-eco. Afin de supprimer votre compte, veuillez d'abord attribuer le rôle Administrateur à un autre membre Bike-eco" | "Gérer les membres" (secondaire) — ouvre l'onglet "Paramètres". Rien n'est supprimé |
  | Sinon | "Cette action supprime définitivement votre compte. Vos dossiers et vos conversations sont conservés." | "Supprimer mon compte" (danger) — supprime le compte et déconnecte |

  Bike-eco has **no cascade** — it is the application, not a tenant, so its last member is
  refused rather than offered a deletion. An empty team would lock everyone out for good:
  `sendInvite` and `setColleagueAdmin` both require an admin caller, so no product path
  could recover it (only `scripts/invite-backoffice.js`, see
  [`first-backoffice-account.md`](../ops/first-backoffice-account.md)).

  The button is never disabled for an administrator, in either role. While the colleague
  list is still loading it is disabled: which modal to open is not yet known.

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
