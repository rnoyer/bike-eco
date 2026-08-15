# bike-eco push audit

**Status: open — nothing here has been implemented.** A review of the push
implementation against invariants extracted from Signal-Android
(`ad141bb6af`) and Signal-iOS (`a9f55ea599`), dated 2026-08-15.

The rubric, the invariants and the full cited evidence live in the
`mobile-push-notifications` skill (`~/.claude/skills/mobile-push-notifications/`):
`references/audit-checklist.md` is the checklist this run followed, and
`references/evidence-signal-{android,ios}.md` back every `[A1]`-style id cited
below. Read `docs/specs/feature-push-notifications.md` first — it is the source
of truth for what the feature already does, and this audit deliberately does not
restate it.

Every finding names a file:line and a failure scenario.

Tiers 0/1 = defects with present-tense wrong behaviour. Tier 2 = missing capability.
Tier 3 = observability. "Not applicable at this scale" is recorded, not silently dropped.

---

## Rank 1 — ENABLER (not itself a bug; blocks ranks 4-8)

**The data payload carries no event identity.**
`functions/src/notifications/send.ts:36-40` — `targetData()` emits exactly
`{kind, companyId}` or `{kind, dossierId}`. There is no event id, no message id,
no timestamp.

Consequence: client-side dedupe, collapsing, targeted dismissal and tray
reconciliation are **impossible**, not merely absent. Every one of ranks 4-8 is
downstream of this. Both Signal clients make the same point from opposite
directions: cancellation matches on payload fields (iOS `[E9]`), and dedupe
lives on the durable event, not the push (Android `[B1]`, iOS `[B1]`).

Smallest fix: add `eventId` (the message doc id, or `${dossierId}:${kind}:${updatedAt}`)
and keep `dossierId` on every kind. Two lines in `targetData`, plus the
`NotificationEvent` arms that build it.

---

## Rank 2 — DEFECT: no sound throttle in the foreground

`src/lib/notifications/useForegroundNotifications.ts:77-88` schedules every
foreground message with `sound: true`, with no minimum interval.

Failure scenario: a back-office user sends five chat messages in ten seconds to a
dealer who has the app open. The dealer's phone chimes five times. With twenty
messages (a burst after a reconnect) it chimes twenty times.

Signal caps this at 2 sounds per 5 seconds and — importantly — **only in the
foreground**, because the OS already coalesces in the background (iOS `[D3]`,
verified: `kAudioNotificationsThrottleCount = 2`, `Interval = 5`). Android uses a
2-second audible floor (`[D8]`). The throttle gates the *sound*, not the banner:
all five banners still appear.

Smallest fix: a module-level ring of recent timestamps in
`useForegroundNotifications`; pass `sound: false` when the last two sounds were
within 5s. Pure function, unit-testable with an injected clock.

## Rank 3 — DEFECT: a push landing mid-navigation shows a banner for the screen being opened

`src/lib/notifications/useForegroundNotifications.ts:70-75` suppresses only when
`current.current.pathname` already matches the target at delivery time.

Failure scenario: dealer taps a dossier's chat from the dashboard. A message
arrives in the ~200-400ms between the tap and the route committing. `pathname` is
still `/dashboard`, so the suppression check misses and a banner is posted for the
thread now filling the screen.

Signal-iOS repairs exactly this and names it: *"there's a narrow window while the
conversationVC is being presented where a message notification for the
not-quite-yet presented conversation can be shown. If that happens, dismiss it as
soon as we enter the conversation"* (`ConversationViewController.swift:390-394`).
Android's equivalent is the `compareAndSet` on pause (`[D7]`).

Smallest fix: dismiss-on-mount in the chat screen, in addition to
suppress-on-present. **Requires rank 1** (needs an identifier to dismiss).

## Rank 4 — GAP: nothing is ever dismissed

No call to `dismissNotificationAsync` or `getPresentedNotificationsAsync` exists
anywhere in `src/` (verified by grep).

Failure scenario: a dealer receives three chat notifications overnight, opens the
app in the morning, reads the thread. All three banners remain in the tray
indefinitely, and re-tapping any of them re-navigates to a thread with nothing new.

This is the largest single gap, and the one Signal invests most in: cancel on read
(iOS `[E1]`), on read-elsewhere (`[E3]`), on delete (`[E4]`), on thread-open
(`[E5]`), plus whole-tray reconciliation on activate (`[E6]`).

## Rank 5 — GAP: status and price changes stack instead of superseding

`useForegroundNotifications.ts:77` calls `scheduleNotificationAsync` with no
`identifier`, so every notification gets a fresh one.

Failure scenario: back-office moves a dossier `a_traiter → en_cours → cloture`
over a minute while the dealer has the app open. Three banners, of which only the
last is true. Same for two price corrections in a row.

Signal's answer is *not* a server collapse key — it is a client-side
`replacingIdentifier`, with a unique UUID as the deliberate non-collapsing default
(iOS `[B4]`, `[B5]`; no collapse id exists anywhere in either repo, `[D10]`).
Chat messages should keep stacking; status/price should supersede.

Smallest fix: the `identifierFor` function in the skill. **Requires rank 1.**

## Rank 6 — GAP: no tray reconciliation on foreground

Failure scenario: dealer reads and handles a dossier on the web/back-office side.
Their phone's tray still shows the status-change banner from yesterday. Nothing
ever removes it.

**Requires ranks 1 and 4.** Note the fail-safe direction Signal chose: an
unrecognised `kind` is *cleared*, so a payload from an older app version cannot
become permanently stuck (iOS `[E6]`).

## Rank 7 — GAP: no badge, and it is a genuine trade-off

No badge code exists; `useForegroundNotifications.ts:62` explicitly sets
`shouldSetBadge: false`.

This is the one item where the evidence does **not** yield a clean recommendation.
bike-eco has no notification service extension, so:

- **Client-derived** (Signal's primary model, `[D6]`) is correct and self-healing, but only updates once the app foregrounds.
- **Server-computed `aps.badge`** is correct on a device that never launches, but is per-recipient — which breaks the per-token multicast batching in `send.ts:186-205` that the spec's "`dispatch` sends per token, not per row" gotcha exists to preserve.

Signal only escapes the dilemma because its NSE recomputes the badge on delivery
(`[D7]`), which has no bike-eco equivalent. Decide deliberately; do not treat this
as a bug fix.

## Rank 8 — OBSERVABILITY: nothing would reveal that pushes stopped arriving

Verified absent: no `sentTime`/`priority` logging, no receipt stamp, no read-back
of presented notifications, no latency measurement.

This matters more here than the rank ordering suggests, because the failure is
**silent by construction** — nothing arrives, so nothing logs, and the first
signal is a dealer phoning support. Three cheap, independent additions:

1. **Log at receipt** (~5 lines, in `onMessage` / a background handler):
   `sentTime`, `priority`, `originalPriority`, and `Date.now() - sentTime`.
   A downgraded `priority` vs `originalPriority` is the tell for FCM throttling an
   app in a restricted standby bucket — without both values a delayed push is
   indistinguishable from a slow network (Android `[F9]`, verified).
2. **Read back what the OS is showing** after scheduling a local notification and
   log the difference. Signal logs literally *"Notifications should be showing but
   are not for N threads"* (Android `[F1]`, verified). Cheapest direct detector
   that exists.
3. **Stamp `lastPushReceivedAt`.** Precondition for inferring loss: content newer
   than the last push received means the token is silently dead (iOS `[F2]`).

If self-healing (token rotation) is ever added, it needs all five brakes from
iOS `[F3]` — in particular a **bake period**, without which the release that adds
the check mass-rotates every token on first launch, because no client has history.

## Rank 9 — PERMISSION: a channel-level block reads as "granted", and the recovery UI never appears

`src/lib/notifications/pushRegistration.ts:88-105` derives permission solely from
`Notifications.getPermissionsAsync().status`, which reports the **app** level.
`src/components/form/SettingsList.tsx:53-58` gates the "Notifications désactivées"
row + `Linking.openSettings()` on `status === "denied"`.

Failure scenario: a dealer long-presses a notification and turns off the `default`
channel (two taps on Android). App-level notifications are still enabled, so
`getPermissionsAsync()` returns `granted`, the Settings row never renders, the app
believes everything is fine, and the dealer receives nothing forever.

Signal checks four independent switches on Android (`[G2]`) and the three
individual alert/badge/sound settings on iOS (`[G5]`), precisely because
`authorizationStatus` alone is misleading. Its source comment says so directly:
*"This could also return true if the specific channnel is enabled, but
notifications overall are disabled, or the messages category is disabled."*

Smallest fix: in `getPushPermission`, also read
`getNotificationChannelAsync("default")` on Android and treat
`importance === NONE` as denied; on iOS check `ios.allowsAlert`. The recovery UI
already exists — this just makes it reachable.

Note this is the same class of bug as rank 3: the *recovery* is built, the
*detection* has a hole.

---

## PASS — checked and correct

- Token upload ordering, retry classification (`unavailable` vs terminal), single-flight device id, one live refresh listener with epoch guard, dead-token pruning with `invalid-argument` correctly excluded, group-by-token at send, recursive delete of `pushTokens`, rules pinning the row shape. All already documented in `feature-push-notifications.md`.
- **Version-scoped registration fast path** (Android `[A4]`): not needed — `registerPushToken` re-uploads on every mount rather than caching a "synced" marker, which achieves the same end more simply.
- **Backwards-clock guard** (`[A5]`): not applicable — no time-based staleness check exists.
- **Suppressed-is-consumed** (Android `[X6]`): PASS — mutes are applied at fan-out in `core.ts:158,181`, so a muted notification is never scheduled and cannot fire later.
- **Denied-state recovery**: PASS in mechanism (`SettingsList.tsx:53-58`), holed in detection (rank 9).
- **Testable seam**: PASS, and *ahead of Signal* — `DispatchDeps`/`ResolveDeps` with tested pure cores is the architecture both Signal clients converged on, with a much smaller untested surface (`[H1]`-`[H4]` Android, `[H1]`-`[H7]` iOS; Signal's 1872-line iOS presenter is entirely untested).

## NOT APPLICABLE AT THIS SCALE

Quiet hours / notification profiles · per-dossier notification channels · a local
metrics DB with remote-config'd percentiles · device/manufacturer advice tables ·
distinct quiet foreground sound assets · repeat-alert loops · iOS interruption
levels · provisional authorization · grouping/summary notifications (marginal at
five event types unless chat volume grows — revisit if it does).

## UNVERIFIED — do not act on without checking

Both scenario-A test agents independently claimed that an FCM notification message
naming a `channelId` that does not exist on the device is dropped on Android 8+,
implying a server-side channel-id flip must lag client adoption. **I could not
confirm this in Firebase's documentation**, and the manifest
`default_notification_channel_id` may provide a fallback. Verify on a device
before relying on it for release sequencing.
