# Confirmation Page specifications

## Navbar props

none

## Main section

The confirmation page is intended to show user its action have been done accordingly. Afte a short delay, there is an auto-redirection to a specified page

Confirmation Page props :

- title : mandatory
- message : optional
- delay : default 500ms
- redirection-link : mandatory

The back-office route (`/(backoffice)/confirmation`) takes `title`, `message`
and `redirectTo` as optional search params, each defaulting to the
dossier-management copy ("Mis à jour" / "Le dossier a bien été mis à jour." /
the dashboard). A second flow reuses the route by passing its own three values —
this is how the dossier recap email confirms.

## Tab bar props

none
