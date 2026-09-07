# Sign in with Apple — design

Add Sign in with Apple everywhere Google sign-in already works: the sign-in screen, the
B2B company registration funnel, and the invited team-member registration funnel.

The driver is App Store review: an app offering any third-party sign-in **must** offer
Sign in with Apple on iOS. Google already qualifies as one, so the app cannot ship to the
App Store without this.

Client: `expo-apple-authentication` (iOS native sheet) + `expo-crypto` (nonce), the
Firebase JS SDK `OAuthProvider("apple.com")` on both iOS and web. Server: a third member
in the two registration callables' `method` discriminated union.

---

## 1. Platform matrix

| Platform | Behaviour |
|---|---|
| iOS | Native Apple sheet via `AppleAuthentication.signInAsync`, then `signInWithCredential` |
| Web | `signInWithPopup(auth, new OAuthProvider("apple.com"))` |
| Android | Apple button not rendered; the module reports unavailable |

Android is out of scope by decision. `expo-apple-authentication` is iOS/tvOS-only, and an
Android implementation would need a full browser round-trip through the Apple Services ID
— real work and an extra redirect scheme to maintain, for a user base (French motorcycle
dealers) that is on iOS and Android *phones*, where only iOS requires the feature at all.

### The three-file split, and why Google's two-file convention does not fit

`googleSignIn.ts` / `googleSignIn.web.ts` works because Google's native module runs on
both iOS and Android, so plain `.ts` is the correct native file. Apple's does not: plain
`.ts` is what **Android** resolves to, and it must not import `expo-apple-authentication`
at all.

| File | Resolved on | Implementation |
|---|---|---|
| `src/lib/auth/appleSignIn.ios.ts` | iOS | `signInAsync` + nonce + `signInWithCredential` |
| `src/lib/auth/appleSignIn.web.ts` | web | `signInWithPopup` |
| `src/lib/auth/appleSignIn.ts` | Android | unavailable stub |

Metro resolves `.ios.ts` before `.ts`, and `.web.ts` before both on web. All three export
the identical signature — divergence breaks a platform silently, which is exactly the
failure mode the auth skill already warns about for `.web.ts` siblings.

```ts
export function isAppleSignInAvailable(): Promise<boolean>;
export function signInWithApple(opts?: { expectedEmail?: string }): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
  isNewUser: boolean;
}>;
```

Same shape as `signInWithGoogle`, so call sites treat the two providers uniformly. The
Android stub returns `false` and throws
`"La connexion Apple n'est pas disponible sur cet appareil."`.

---

## 2. The nonce

Reversing the two halves is the classic Sign in with Apple bug and fails with
`auth/missing-or-invalid-nonce`. The direction, per Firebase's own documentation:

```
raw nonce ── SHA-256 (hex) ──▶ AppleAuthentication.signInAsync({ nonce: hashed })
    │
    └─────── raw, unhashed ──▶ provider.credential({ idToken, rawNonce: raw })
```

`expo-crypto` provides both halves: `getRandomBytes(32)` for the raw nonce, and
`digestStringAsync(CryptoDigestAlgorithm.SHA256, raw)` — which returns **hex by default**,
which is the encoding Apple expects.

Web needs none of this. `signInWithPopup` runs the whole OAuth flow itself and manages its
own nonce, so `appleSignIn.web.ts` never imports `expo-crypto`.

---

## 3. Email matching in the invited funnel

The invited-registration funnel locks the account to the invitation's address. The
governing invariant, documented in `googleSignIn.ts`:

> Never let a credential reach Firebase Auth until the checks pass. An identity that got
> as far as `signInWithCredential` and is then refused leaves an Auth record with no
> profile, no claims and no password — unreachable and impossible to clean up
> client-side.

Google satisfies this trivially: the native SDK hands over the email before the credential
is built. **Apple cannot always do so.** Apple returns `fullName` and `email` on
`AppleAuthenticationCredential` only on the *first* authorization for a given Apple ID; on
every later sign-in both are `null`. The `email` claim inside the identity token is
documented as present but is widely reported missing after a revoke/re-authorize, so it
cannot be relied on either.

So the check is two-tier:

**Tier 1 — email known before the credential is built.** From `credential.email`, else
from the `email` claim decoded out of the identity token. Compare; on mismatch throw
`ProviderEmailMismatchError` before `signInWithCredential`. Invariant fully preserved,
and this is the common case (a user registering has by definition not authorized before).

**Tier 2 — no email available.** Call `signInWithCredential`, read `auth.currentUser.email`
(Firebase persisted it on the account from the first sign-in), compare, and undo on
mismatch: `deleteUser` when `isNewUser`, `signOut` otherwise. This is not a new pattern —
it is what `googleSignIn.web.ts` already does, for the same reason (the popup has signed
in by the time it returns, so a mismatch is undone rather than prevented).

`acceptInviteCore` keeps rejecting a mismatched email server-side regardless. That stays
the real enforcement; both tiers are there to avoid stranding an Auth record.

### Decoding the identity token

`src/lib/auth/appleIdToken.ts` — `appleIdTokenEmail(idToken): string | null`, a
base64url-decode of the JWT payload reading the `email` claim. **No signature
verification**, and none is needed: the value is used only to decide whether to *abandon*
a sign-in early. A forged token buys an attacker nothing, because the credential itself is
still verified by Firebase, and the server still re-checks the email against the
invitation. Pure, no native imports, unit-tested.

---

## 4. Profile prefill

| Field | First authorization | Repeat authorization |
|---|---|---|
| prénom / nom | `fullName.givenName` / `.familyName` | `null` — user types them in "Vos coordonnées" |
| email | `credential.email` | `auth.currentUser.email` after sign-in |

No new persistence. `nom` and `prenom` are already required, editable fields on the
"Vos coordonnées" step; the provider paths prefill them as a convenience, and an empty
prefill simply means the user fills them in as they would in the password flow.

On web, Apple's name arrives as a single `displayName`, split best-effort into
prénom / nom exactly as `googleSignIn.web.ts` already does for Google.

---

## 5. De-Google-ifying the shared plumbing

The provider-agnostic pieces stop being named for Google. `emailsMatch` stays shared
rather than being duplicated per provider.

| Today | Becomes |
|---|---|
| `src/lib/auth/googleEmail.ts` | `src/lib/auth/providerEmail.ts` |
| `GoogleEmailMismatchError` | `ProviderEmailMismatchError(provider, email, expected)` |
| `googleEmailMismatchMessage` | `providerEmailMismatchMessage(provider, …)` |
| `src/features/registration/googleAuth.tsx` | `src/features/registration/providerAuth.tsx` |
| `GoogleAuthContext` / `onGoogleProfile` | `ProviderAuthContext` / `onProviderProfile` |
| `usedGoogle: useRef<boolean>` | `usedProvider: useRef<AuthProviderId \| null>` |
| `"google-auth-placeholder"` | `"provider-auth-placeholder"` |
| `method: "password" \| "google"` | `method: "password" \| "google" \| "apple"` |

`AuthProviderId = "google" | "apple"` is defined once, in `providerAuth.tsx`, and imported
by everything that needs it.

Renaming our `GoogleAuthProvider` export to `ProviderAuthProvider` also removes a live
trap: it currently shadows Firebase's own `GoogleAuthProvider`, and both are in scope in
the registration screens.

The mismatch copy becomes provider-aware:

> Le compte **Apple** cyclist@example.com ne correspond pas à l'invitation envoyée à
> pro@garage.fr. Reprenez avec le bon compte **Apple**.

---

## 6. Cancellation copy

`authErrors.ts` tells two kinds of failure apart by a rule its doc comment spells out:
Firebase's `auth/*` errors carry a `code` and an English message (map the code); the
errors this app raises itself are already French and carry **no** `code` (keep the
message).

Apple's cancellation throws `code: "ERR_REQUEST_CANCELED"` — a `code` that is not an
`auth/*` code, so `frenchAuthMessage` would fall through to the generic
`"La connexion a échoué. Veuillez réessayer."` for what is just a user tapping Cancel.

`appleSignIn.ios.ts` therefore catches it and rethrows a bare
`new Error("Connexion Apple annulée.")` with no `code`, exactly as `googleSignIn.ts` does
for its own cancellation. No change to `authErrors.ts` is required — the contract already
covers this, provided the provider module honours it.

---

## 7. Sign-in screen: one handler, both providers

`signin.tsx:57-105` inlines a rule that belongs to the auth layer: **sign-in is not
registration.** A provider identity with no `users/{uid}` document has never been through
a funnel, so it is refused — and the Auth record this very attempt created is deleted
(`isNewUser`) rather than left dormant; a pre-existing record is only signed out.

Adding Apple would duplicate those ~40 lines. Instead they move to
`src/lib/auth/thirdPartySignIn.ts`:

```ts
export async function signInExistingAccount(provider: AuthProviderId): Promise<void>;
```

It dispatches to the right provider module, races the `users/{uid}` read against the
shared `WRITE_TIMEOUT_MS` (Firestore buffers an unreachable read rather than rejecting,
which would hang the button), maps Firestore codes through `mapDataError`, and throws an
already-French `Error` on refusal — so `frenchAuthMessage` passes it through untouched.

`signin.tsx` keeps one `useAsyncAction` for both providers and one pending flag, which
disables the whole button row during any round-trip.

Refusal copy, per provider:

> Aucun compte Bike-eco n'est associé à ce compte **Apple**. Créez un compte pour continuer.

---

## 8. The button

Apple's Human Interface Guidelines permit a custom button only with the official logo, an
approved title, approved colors and proportions. The existing row's label would be just
"Apple", which is **not** an approved title — the approved French titles are
"Se connecter avec Apple" and "Continuer avec Apple". So the current row style cannot be
reused verbatim on any platform.

| File | Resolved on | Renders |
|---|---|---|
| `src/components/ui/AppleAuthButton.ios.tsx` | iOS | native `AppleAuthenticationButton` |
| `src/components/ui/AppleAuthButton.web.tsx` | web | outlined custom button, `appleIcon.svg`, "Continuer avec Apple" |
| `src/components/ui/AppleAuthButton.tsx` | Android | `null` |

On iOS the native component is used with `WHITE_OUTLINE` style,
`cornerRadius={tokens.radius.md}` and `height: tokens.button.height`, which lands visually
next to the existing outlined buttons while being Apple-approved, system-localized to
French and accessible for free. It renders only when `isAvailableAsync()` resolves true.

`ThirdPartyAuthButtons` keeps its `PROVIDERS` array for Google and renders
`<AppleAuthButton onPress={() => onPress("apple")} disabled={disabled} />` after it. The
Apple entry is removed from the commented-out block. Facebook stays commented out.

---

## 9. Server side

Both discriminated unions gain a third member. Zod v4, in
`functions/src/registration/schemas.ts`:

```ts
const registerCredential = z.discriminatedUnion("method", [
  z.object({ method: z.literal("password"), email: z.email(), password: z.string().min(8) }),
  z.object({ method: z.literal("google") }),
  z.object({ method: z.literal("apple") }),
]);
```

and the same third member on `acceptCredential`. Three explicit literal members rather
than one enum member, so the shape stays legible and a future provider with its own
payload fields can be added without restructuring.

`registerCompanyCore` and `acceptInviteCore` already branch on
`input.method === "password"` with an else covering every provider, so the logic needs no
change — only the hardcoded copy does:

| Line | Today | Becomes |
|---|---|---|
| `core.ts:77`, `core.ts:162` | `"Connexion Google requise."` | `` `Connexion ${providerLabel(input.method)} requise.` `` |
| `core.ts:164` | `"Ce compte Google ne correspond pas à l'invitation."` | `` `Ce compte ${providerLabel(input.method)} ne correspond pas à l'invitation.` `` |

`providerLabel(method)` maps `"google" → "Google"`, `"apple" → "Apple"`.

Client-side, `RegisterCompanyPayload["method"]` and `AcceptInvitePayload["method"]` in
`src/lib/data/registration.ts` widen to the same union, and
`submitInvitedRegistration`'s `method` parameter with them.

---

## 10. Decisions recorded, not built

### Hide My Email

Apple's "Masquer mon adresse email" yields an `@privaterelay.appleid.com` address. Relay
forwarding only works for sender domains registered with Apple, and this project sends
transactional mail over generic SMTP from the `SMTP_USER` account. **Relay addresses are
accepted anywhere** — no code refuses them.

The consequence, documented so it is not rediscovered as a bug: the registration
confirmation sent by `sendApplicantEmail`, and any later contact by the back office, will
**not reach** a dealer who registered with a relay address, until the sender domain is
registered with Apple's private email relay service. That registration is owner
prerequisite 5 below and lifts the limitation with no code change.

### Account collision

An Apple identity whose email already has a password account is governed by the Firebase
project-level setting, which already governs Google identically. On "Link accounts that
use the same email" (the modern default) Firebase links the Apple provider to the existing
account and signs in — the desired behaviour, with no code. No new code path is added;
confirming the setting is owner prerequisite 4.

---

## 11. Error handling

| Failure | Surfaced as |
|---|---|
| User cancels the Apple sheet | "Connexion Apple annulée." (bare `Error`, no `code`) |
| Apple unavailable (Android, or iOS < 13) | Button not rendered; stub throws if reached |
| Email ≠ invitation | `ProviderEmailMismatchError`, naming both addresses |
| Signed in but no `users/{uid}` | "Aucun compte Bike-eco n'est associé à ce compte Apple. …" |
| Firestore unreachable during the profile check | `mapDataError(code)`, after `signOut` |
| Nonce mismatch (`auth/missing-or-invalid-nonce`) | `mapAuthError` fallback — a bug, not a user state |

Every message reaches the user through `frenchAuthMessage`. No new inline copy in screens.

---

## 12. Testing

House style per `docs/tech/verification.md`: pure logic is unit-tested, screens and
components are gated by `tsc` + lint. The Apple logic is deliberately shaped so the
testable parts sit in modules that import nothing native.

| Test file | Covers |
|---|---|
| `src/lib/auth/appleIdToken.test.ts` | email claim decoded from a hand-built JWT; malformed / absent claim → `null` |
| `src/lib/auth/providerEmail.test.ts` | existing `emailsMatch` cases, plus the message for each provider label |
| `functions/src/registration/schemas.test.ts` | `method: "apple"` accepted; a password alongside it rejected |
| `functions/src/registration/core.test.ts` | apple invited mismatch says "Apple"; unauthenticated apple says "Connexion Apple requise." |
| `src/lib/auth/authErrors.test.ts` | a bare French `Error` passes through untouched (the cancellation contract) |

The gate: `npx tsc --noEmit && npx expo lint && npm test`, plus `cd functions && npm test`.

---

## 13. Configuration

`app.json`:

```json
"ios": { "usesAppleSignIn": true },
"plugins": ["expo-apple-authentication", …]
```

New dependencies, installed with `npx expo install` (never bare `npm install`):
`expo-apple-authentication`, `expo-crypto`.

---

## 14. Owner prerequisites — blocking, and not performable from here

1. **Apple Developer → Certificates, Identifiers & Profiles**: enable the **Sign In with
   Apple** capability on `com.bikeeco.app`.
2. **Apple Developer**: create a **Services ID** registering the return URL
   `https://bike-eco-43a84.firebaseapp.com/__/auth/handler`, and create a **Sign in with
   Apple private key** (note the key ID and the team ID). Firebase requires these even for
   an iOS-only integration, and the web popup requires the Services ID specifically.
3. **Firebase console → Authentication → Sign-in method**: enable **Apple**, and fill in
   the Services ID, Apple Team ID, key ID and private key.
4. **Firebase console → Authentication → Settings**: confirm whether the project is on
   "Link accounts that use the same email" (see §10).
5. *(optional, lifts the §10 email limitation)* Register the SMTP sender domain with
   Apple's private email relay service.
6. **An EAS iOS build.** Adding a native module requires rebuilding the dev client, and
   this machine is Linux — `npx expo run:ios` is not available. The build is paid and
   will be proposed, never triggered unasked.

Nothing in 1–5 can be done from this repo, and Apple sign-in cannot be tested on a device
until 1–3 and 6 are complete. Every other part of the change is verifiable here through
the gate.

---

## 15. Documentation updated in the same commits

Per `AGENTS.md`, a spec stays in sync in the change that alters its feature:

- `docs/specs/page-login-signup.md` — Apple as a second active provider, its refusal copy.
- `docs/specs/form-b2b-company-registration.md` — the Apple path through "Votre compte".
- `docs/specs/form-b2b-invited-registration.md` — the same, plus the email-match rule.
- `.claude/skills/bike-eco-auth/SKILL.md` — the three-file platform split, the nonce
  direction, the two-tier email check, and the cancellation-copy contract.
