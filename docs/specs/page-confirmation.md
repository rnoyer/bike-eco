# Confirmation Page specifications

## Navbar props

none

## Main section

The confirmation page is intended to show user its action have been done accordingly. Afte a short delay, there is an auto-redirection to a specified page

Above the title sits the confirmation mark: `ui/AnimatedCheck`, the
`assets/images/icons/tick.svg` circle-and-tick drawn stroke by stroke in
`tokens.colors.success` — the arc sweeps closed over 600 ms and the tick strokes
through it from 400 ms, 750 ms in total. It renders already-drawn when the system
asks for reduced motion.

Confirmation Page props :

- title : mandatory
- message : optional
- delay : default 750ms, the time the mark takes to draw — anything shorter
  redirects mid-stroke
- redirection-link : mandatory

The back-office route (`/(backoffice)/confirmation`) takes `title`, `message`
and `redirectTo` as optional search params, each defaulting to the
dossier-management copy ("Mis à jour" / "Le dossier a bien été mis à jour." /
the dashboard). A second flow reuses the route by passing its own three values —
this is how the dossier recap email confirms. The delay is not a param: both
concrete routes (`(backoffice)` and `(b2b)`) pass 1500 ms, longer than the
component's 500 ms default, so the confirmation is readable before it redirects.

## Tab bar props

none
