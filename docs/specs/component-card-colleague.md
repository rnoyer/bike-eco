# Colleague's Card specifications

Card UI is identical to component-card-company. Each card represents a user.

Colleague's Card props :

- title : "[Nom] [Prénom]"
- subtitle : "Rôle: [Administrateur|Vendeur|Membre]"
- right : optional button — "Gérer" on page-colleagues (administrators only, opens
  page-colleague), "Voir détails" on page-company (opens page-colleague read-only).
  With no button the card is plain, non-clickable information.
