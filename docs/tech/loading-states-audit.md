# Loading-state audit

Inventory of every asynchronous / UI-blocking operation in the client (`src/`), with the
loading feedback it shows today. Written to explain a recurring symptom: the app goes
still after a tap — no spinner, no disabled button — for as long as a Firebase round-trip
or a photo upload takes.

**§3 records the state that prompted the work; §5 records what shipped in response.** The
inventory is kept as the "before" picture — it is why the primitives in §2 look the way
they do, and it is the checklist to re-run when a new call site is added.

---

## 1. Summary

81 async call sites. Loading was not forgotten everywhere — the app has two good patterns
(`Section`'s spinner for reads, a local `busy` boolean for writes) that were never
generalised. Three structural holes explain nearly every symptom:

1. **`FormLayout`'s primary button accepts no `disabled`/`loading` prop at all**
   (`src/components/form/FormLayout.tsx:77-85`), and `useStepForm` never surfaces
   `formState.isSubmitting` (`src/lib/forms/useStepForm.ts:32-41`). Every funnel therefore
   guards its submit with a `useRef` — which blocks a double-send but **never re-renders**,
   so the button looks idle for the whole submit. This covers six of the app's slowest
   actions, including both photo-upload funnels.
2. **`Button` has no `loading` prop** (`src/components/ui/Button.tsx:12-18`) — only
   `disabled`, which just sets `opacity: 0.5`. Callers hand-roll a `busy` state and get
   dimming, never a spinner. There is no shared `Spinner` component either;
   `ActivityIndicator` is duplicated in five places with ad-hoc padding.
3. **Mutation hooks expose no pending state.** `useSendMessage`, `useInvite` and
   `useDossierManagement` return only the action, leaving the caller to own the pending
   flag — which three of the four call sites then don't do.

A fourth, narrower issue: **no upload in the app can report progress**, because
`src/lib/storage/upload.ts:42` uses non-resumable `uploadBytes`. `uploadBytesResumable`
appears nowhere in the repo.

---

## 2. Conventions that already work

Reuse these rather than inventing new ones.

| Primitive | Path | Notes |
|---|---|---|
| `Section` — title + `loading` spinner + `emptyMessage` | `src/components/ui/Section.tsx:22-26` | The blessed read-loading pattern. `bike-eco-ui` SKILL.md: "owns all three states — don't reimplement them per screen" |
| `Button` `disabled` | `src/components/ui/Button.tsx:37,40-41` | Dimming only, no spinner |
| `busy` + `run()` write wrapper | `src/app/(backoffice)/companies/[id].tsx:47-61` | Best write site in the repo: re-entry guard, `disabled` on all four buttons, mapped-error `Alert` |
| `googleBusy` / `forgotBusy` / `resetBusy` | `signin.tsx:36-37`, `AccountScreen.tsx:23` | The correct per-action state shape |
| `writeWithTimeout` (15 s) | `src/lib/firestore/writeWithTimeout.ts:2,33` | The only defence against Firestore buffering an unreachable write forever |
| `{ data, loading, error }` key-match derivation | `src/lib/data/useDossiers.ts:54-76` | Every read hook already conforms |
| Design tokens | `src/theme/tokens.ts` | Any new spinner: `color={tokens.colors.primary}`, `tokens.space.*` padding |
| French error mapping | `mapAuthError`, `mapDataError`, `mapPasswordResetError`, `frenchError` (`src/lib/data/callable.ts:5-20`) | A screen renders a mapped message, never its own |

---

## 3. Inventory

Legend for **Loading**: **NONE** = no feedback of any kind · **REF** = `useRef` guard, no
re-render · **DIM** = button dims via `disabled` · **SPIN** = spinner shown.

### 3.1 Auth screens

| File:line | Operation | Trigger | Loading |
|---|---|---|---|
| `(auth)/signin.tsx:43` | `signInWithEmailAndPassword` | "Login" | **NONE** — no busy flag; button re-tappable |
| `(auth)/signin.tsx:58` | `signInWithGoogle()` | Google button | DIM — `googleBusy` → `ThirdPartyAuthButtons disabled` (`:163`) |
| `(auth)/signin.tsx:73-78` | `getDoc(userDoc)` in `writeWithTimeout` — "is this identity registered?" | Google button | DIM — `googleBusy` |
| `(auth)/signin.tsx:83,93,94` | `signOut` / `deleteUser` — unregistered-Google cleanup | Google button | DIM — `googleBusy` |
| `(auth)/signin.tsx:125` | `sendPasswordResetEmail` | "Mot de passe oublié" | DIM — `forgotBusy` (`:157`) |
| `(auth)/register.tsx:40` | callable `registerCompany` (Google path) | "S'inscrire" | **REF** — `submitting` ref `:24` |
| `(auth)/register.tsx:53` | `submitCompanyRegistration` → callable `registerCompany` | "S'inscrire" | **REF** |
| `(auth)/register.tsx:68` | `signOut` in `goHome()` | "Retour à l'accueil" / "Précédent" on step 1 | **NONE** |
| `(auth)/register-invited.tsx:69` | callable `acceptInvite` (Google) | "S'inscrire" | **REF** — `:36` |
| `(auth)/register-invited.tsx:84` | `submitInvitedRegistration` → callable `acceptInvite` | "S'inscrire" | **REF** |
| `(auth)/register-invited.tsx:106` | `signInWithEmailAndPassword` | "Aller à l'accueil" | **NONE** — `FormConfirmation`'s button has no `disabled` prop |
| `(auth)/register-invited.tsx:108` | `refreshSession()` → `getIdTokenResult(true)` + `getDoc` | same | **NONE** |
| `(auth)/invite-code.tsx:34` | callable `resolveInvite` | "Continuer" | **REF** — `:21` |
| `(auth)/pending.tsx:15` | `signOut` | "Se déconnecter" | **NONE** |
| `lib/auth/AuthProvider.tsx:61-64` | `Promise.all([getIdTokenResult(true), getDoc(userDoc)])` | every auth-state change + `refreshSession` | SPIN — `initializing` → `_layout.tsx:30` `ActivityIndicator`. Later `loading` flips deliberately show nothing (comment `_layout.tsx:25-29`) |
| `lib/auth/AuthProvider.tsx:94` | `onAuthStateChanged` | app start | SPIN — `initializing` |
| `lib/auth/AuthProvider.tsx:119` | `signOut: () => fbSignOut(auth)` | all sign-out buttons | **NONE** |
| `lib/auth/googleSignIn.ts:31,35,36,45,48` | `hasPlayServices` / `signOut` / `signIn` / `signInWithCredential` | any Google button | **NONE** internally (caller-provided only) |
| `lib/auth/googleSignIn.web.ts:22,29,30` | `signInWithPopup` / `deleteUser` / `signOut` | Google on web | **NONE** |
| `features/registration/fields.tsx:28` | `signInWithGoogle({expectedEmail})` | Google inside "Votre compte" step | **NONE** — `ThirdPartyAuthButtons` rendered at `:78` **without** `disabled`, unlike `signin.tsx` |
| `features/registration/fields.tsx:41` | `onGoogleProfile` → step advance | same | **NONE** |

### 3.2 Forms / funnels

| File:line | Operation | Trigger | Loading |
|---|---|---|---|
| `b2cSubmissionForm.tsx:32` | `submitB2cSubmission` — multipart POST to `sendB2cSubmission` | "Envoyer" | **REF** — `:21`. Longest wait in the app: every full-size photo in one multipart body |
| `features/b2c-submission/submit.ts:43,67,73,82` | web blob read · **sequential** `appendPhoto` loop · `fetch` POST · error-body parse | same | **NONE** |
| `(b2b)/vehicule-submission.tsx:34` | `submitB2bSubmission` | "Envoyer" | **REF** — `:21` |
| `features/b2b-submission/submit.ts:60` | `getDocFromServer(companyDoc)` — forced-server reachability probe | same | **NONE** |
| `features/b2b-submission/submit.ts:67-71` | `makeThumbnail` (`ImageManipulator` render+save) then upload | same | **NONE** — CPU-bound |
| `features/b2b-submission/submit.ts:74-79` | **sequential** `uploadLocalFile` per photo | same | **NONE** |
| `features/b2b-submission/submit.ts:84-102` | `writeWithTimeout(setDoc, deleteDoc, 15000)` | same | **NONE** |
| `(b2b)/add-colleague.tsx:17` | `invite(email)` → callable `sendInvite` | "Envoyer l'invitation" | **NONE** — no ref, no state, no `disabled`. Each tap sends another email |
| `lib/forms/useStepForm.ts:64` | `form.trigger(step fields)` — Zod per-step | every "Suivant" | **NONE** |
| `lib/forms/useStepForm.ts:67` | `form.handleSubmit(onSubmit)()` — awaits the whole submit chain | "Envoyer"/"S'inscrire" | **NONE** — `isSubmitting` never exposed; `FormLayout:77-85` has no `disabled`/`loading` prop |
| `components/form/PhotoPicker.tsx:24,29,40,45` | media-library / camera permission + launch | "Galerie" / "Appareil Photo" | **NONE** |

### 3.3 Dashboard / data hooks

| File:line | Operation | Trigger | Loading |
|---|---|---|---|
| `lib/data/useDossiers.ts:54` | `onSnapshot(query(...))` — called 3× | `DashboardScreen` mount (`:27-29`) | SPIN — `loading` `:70` → `DossiersSection` → `Section` |
| `lib/data/useDossier.ts:20` | `onSnapshot(dossierDoc)` | dossier detail / chat / management | SPIN in detail (`:15`) + management (`:17`); `DossierChatScreen:43` returns `null` (blank) |
| `lib/data/useCompanies.ts:30` | `onSnapshot(companies query)` | back-office list, `PendingCompaniesBanner` | SPIN via `Section`; the banner ignores `loading` |
| `lib/data/useCompanies.ts:58` | `onSnapshot(companyDoc)` | `companies/[id].tsx:25`, `AccountScreen:20` | SPIN in `companies/[id].tsx:30`; unused in `AccountScreen` |
| `lib/data/useCompanies.ts:82` | `onSnapshot(users where companyId)` | `companies/[id].tsx:26` | SPIN |
| `lib/data/useRegionFilter.ts:25` → `region-store.ts:7` | `Storage.getItem` (kv-store / localStorage) | first `useRegionFilter()` | **`ready` exposed but no consumer reads it** — `DashboardScreen:25`, `SettingsList:26`, `companies/index.tsx:14`, `PendingCompaniesBanner:8` all take only `{ region }`. First render queries "Toute la France", then re-queries |
| `lib/data/useRegionFilter.ts:63` | `Storage.setItem` (fire-and-forget) | région dropdown | **NONE** — intentionally optimistic |
| `lib/data/useAccount.ts` | passthrough of `useAuth()` | `AccountScreen:19` | `loading` returned, but `AccountScreen:55` renders `null` — blank screen |

### 3.4 Dossier detail

| File:line | Operation | Loading |
|---|---|---|
| `components/screens/DossierDetailScreen.tsx:11` | `useDossier(id)` | SPIN `:15` |
| `components/ui/PhotoCarousel.tsx:41` | `expo-image` remote fetch | **NONE** beyond `transition={150}` + placeholder background |

### 3.5 Chat

| File:line | Operation | Trigger | Loading |
|---|---|---|---|
| `lib/data/useMessages.ts:25` | `onSnapshot(messages orderBy createdAt)` | opening Messages tab | `loading` returned `:38` but **`DossierChatScreen:18` destructures only `{ data }`** — thread renders empty |
| `lib/data/useSendMessage.ts:41` | `uploadLocalFile` — **sequential loop, up to 5 attachments**, each = XHR blob read + `uploadBytes` + `getDownloadURL` | "Envoyer" | **NONE** |
| `lib/data/useSendMessage.ts:54` | callable `sendMessage` | same | **NONE** |
| `lib/storage/cleanup.ts:24` | `Promise.allSettled(deleteObject…)` | failure path | **NONE** |
| `components/screens/DossierChatScreen.tsx:63-67` | `send(text, files).catch(Alert)` — fire-and-forget | "Envoyer" | **NONE** — and `ChatComposer.tsx:45-51` clears `text` **and** `files` immediately. A failure alerts *after* the message and attachments are gone. No pending bubble, no disabled send |
| `components/ui/chat/ChatComposer.tsx:59,64` | media permission + `launchImageLibraryAsync` | "+" → Photo | **NONE** |
| `components/ui/chat/ChatComposer.tsx:90` | `DocumentPicker.getDocumentAsync({copyToCacheDirectory:true})` | "+" → PDF | **NONE** — the cache copy is slow for large PDFs |
| `components/ui/chat/ChatThread.tsx:28` | `Linking.openURL(pdf)` | tapping a PDF | **NONE** |
| `components/ui/chat/ChatThread.tsx:48-53,62` | `expo-image` attachment thumbnails | render | **NONE** beyond `transition={100}` |

### 3.6 Back-office

| File:line | Operation | Trigger | Loading |
|---|---|---|---|
| `(backoffice)/companies/[id].tsx:72,160` | callable `deleteCompany` via `run()` | "Décliner inscription" / "Supprimer tout" | DIM — `busy` `:27`, guard `:48`, `disabled` on `:88,95,129,153,162` |
| `(backoffice)/companies/[id].tsx:87` | callable `approveCompany` via `run()` | "Autoriser" | DIM — `busy` |
| `(backoffice)/companies/[id].tsx:25-26` | `useCompany` + `useCompanyUsers` | mount | SPIN `:30` |
| `(backoffice)/dossier/[id]/management.tsx:25` → `useDossierManagement.ts:21` | `updateDoc(dossierDoc)` | "Mettre à jour" | **NONE** — no busy state, no `disabled`, and **not** wrapped in `writeWithTimeout` |
| `(backoffice)/dossier/[id]/management.tsx:11` | `useDossier(id)` | mount | SPIN `:17` |
| `(backoffice)/companies/index.tsx:15-16` | two `useCompanies` | mount | SPIN via `Section` |
| `components/ui/PendingCompaniesBanner.tsx:9` | `useCompanies("pending", region)` | mount | `loading` ignored; renders `null` until non-empty |

### 3.7 Settings / account

| File:line | Operation | Trigger | Loading |
|---|---|---|---|
| `components/screens/AccountScreen.tsx:30` | `sendPasswordResetEmail` | "Changer mon mot de passe" → confirm | DIM — `resetBusy` `:23`, `disabled` `:79` |
| `components/screens/AccountScreen.tsx:72` | `signOut` passed **directly** as `onPress` | "Se déconnecter" | **NONE** |
| `components/screens/AccountScreen.tsx:19-20,55` | `useAccount` + `useCompany` | mount | `loading` present, rendered as `return null` |
| `components/form/SettingsList.tsx:37` | `setRegion` → `void saveRegion(r)` | région dropdown | **NONE** — optimistic |

Stubs, not yet async: "Supprimer mon compte" (`AccountScreen.tsx:89-94`) and back-office
"Inviter un collègue" (`(backoffice)/(tabs)/settings.tsx:11`) are `Alert.alert`
placeholders. Both will need pending state when wired.

### 3.8 Infrastructure

| File:line | Note |
|---|---|
| `lib/data/callable.ts:24-25` | `httpsCallable` + `await fn(data)` — the single choke point for **every** Cloud Function call. No timeout, no abort, no shared pending signal |
| `lib/storage/upload.ts:23-32` | `blobFromUri` reads the *whole* file into memory before the upload starts |
| `lib/storage/upload.ts:42` | `uploadBytes` — **non-resumable, so progress events are not available anywhere in the app** |
| `lib/storage/upload.ts:43` | `getDownloadURL` — an extra round-trip after every single upload |
| `lib/storage/upload.ts:54-62` | `makeThumbnail` — CPU-bound `ImageManipulator` pass on the B2B submit path |
| `lib/firestore/writeWithTimeout.ts:2,33` | `WRITE_TIMEOUT_MS = 15000`, `Promise.race`. Used by `signin.tsx:73` and `b2b-submission/submit.ts:84` only |
| `firebase.core.ts:24` | `storage.maxUploadRetryTime = 20000` — caps a *failing* upload at 20 s |
| `firebaseConfig.ts:25-26` | `initializeAuth` with AsyncStorage persistence; its async restore is what `initializing` covers |
| `app/_layout.tsx:14-23,30` | `AuthGate` — navigation gated on `loading`, splash on `initializing` |
| `components/ui/ConfirmationView.tsx:20-23` | `setTimeout(router.replace, 1500)` — an *artificial* delay, unrelated to network |

---

## 4. Ranked gaps

### A. Zero feedback on a long, user-initiated network call

1. **`signin.tsx:43`** — `signInWithEmailAndPassword` has no busy flag; the Login button
   is double-tappable. The Google and forgot-password paths *on the same screen* are both
   correctly guarded.
2. **`add-colleague.tsx:17`** — no guard whatsoever. Each extra tap sends another
   invitation email.
3. **`management.tsx:25` → `useDossierManagement.ts:21`** — a bare `updateDoc`, not wrapped
   in `writeWithTimeout`. Offline, Firestore buffers the write and the promise never
   settles: the button stays live and the screen neither navigates nor errors. An
   indefinite silent hang.
4. **`DossierChatScreen.tsx:63`** — fire-and-forget `send()` over up to five *sequential*
   uploads, while `ChatComposer.tsx:45-51` clears the text and attachments immediately.
   A failure alerts the user after their input is already lost. This is a data-loss bug,
   not only a missing spinner.
5. **`register-invited.tsx:106,108`** — sign-in + `refreshSession()` behind "Aller à
   l'accueil"; `FormConfirmation`'s button has no `disabled` prop at all.
6. **`features/registration/fields.tsx:28`** — Google sign-in in both registration funnels,
   rendered without the `disabled` prop `signin.tsx:163` passes.
7. **Every `signOut` site** — `pending.tsx:15`, `AccountScreen.tsx:72`, `register.tsx:68`.

### B. Ref-guarded but visually inert

`b2cSubmissionForm.tsx:21`, `vehicule-submission.tsx:21`, `register.tsx:24`,
`register-invited.tsx:36`, `invite-code.tsx:21` — `submitting.current` blocks the
double-send, but because it is a ref nothing re-renders and the button never changes.

Root cause is hole (1) in §1: fixing `FormLayout` + `useStepForm` covers all five at once.
The two submission funnels are the app's longest waits — sequential per-photo uploads,
plus for B2B a thumbnail render and a forced `getDocFromServer` probe.

### C. `loading` computed, then discarded by the consumer

- `useMessages` → `DossierChatScreen.tsx:18` takes only `{ data }`; the thread renders
  empty instead of loading.
- `useRegionFilter`'s `ready` → ignored by all four consumers, so the dashboard's first
  render queries "Toute la France" and re-queries once hydration lands — a visible flicker.
- `useAccount` / `useCompany` → `AccountScreen.tsx:55` renders `null`: a blank screen.
- **Every hook's `error` is mapped to French and then never rendered anywhere.** No
  consumer destructures it.

### D. Silent non-network waits

`PhotoPicker.tsx:24-45` and `ChatComposer.tsx:59-90` (`DocumentPicker` with
`copyToCacheDirectory`); `upload.ts:23-32` reading whole files into memory before the
upload begins; `makeThumbnail`'s CPU-bound pass.

---

## 5. What shipped

### New primitives

| Primitive | Path | Replaces |
|---|---|---|
| `Spinner` + `ScreenLoader` | `src/components/ui/Spinner.tsx` | The five duplicated `ActivityIndicator`s and their ad-hoc padding |
| `ScreenMessage` | `src/components/ui/ScreenMessage.tsx` | Per-screen "introuvable" `Text` styling; new home for screen-level read errors |
| `Button` `loading` | `src/components/ui/Button.tsx` | Every hand-rolled `busy` boolean that only dimmed a button |
| `useAsyncAction` | `src/lib/ui/useAsyncAction.ts` | `companies/[id]`'s `run()`, `googleBusy`/`forgotBusy`/`resetBusy`, and the ungated sites in A |
| `frenchAuthMessage` | `src/lib/auth/authErrors.ts` | The `code?.startsWith("auth/") ? … : …` ladder duplicated in sign-in and the registration fields |

`useAsyncAction` is the load-bearing one: it owns the re-entry guard, the pending flag and
the mapped-error surfacing, and `useInvite` / `useDossierManagement` compose it so their
callers get `pending` without a second mechanism. Its contract is documented in
`.claude/skills/bike-eco-ui/SKILL.md`.

### Behaviour changes

- **Funnels.** `useStepForm` now returns `submitting` (react-hook-form's `isSubmitting`)
  and refuses to re-enter `next` while it is true; `FormLayout` takes `busy` and renders
  the nav buttons as `ui/Button`s, so "Envoyer" spins and both disable. All five `useRef`
  guards are gone. *(Chosen over a full-screen overlay.)*
- **Chat.** `useSendMessage` holds an optimistic `pending` list: a sent message appears in
  the thread immediately, greyed with a spinner, and on failure keeps the user's text and
  attachments with **Réessayer** / **Supprimer**. This removes the data-loss bug in A.4 —
  the composer still clears instantly, but the content now lives in the bubble until it
  succeeds or is explicitly discarded.

  Retry re-sends under the **original** message id, so it cannot duplicate the message:
  `sendMessage` writes with `create()`, which rejects an id that already exists. That also
  means a send whose *response* was lost — message written, client saw an error — could
  never be retried successfully. So `DossierChatScreen` drops a placeholder whose id shows
  up in the live thread: `useMessages` now returns `WithId<Message>` and the delivered
  document is the evidence that the send worked. Without that reconciliation the user
  would see a "failed" bubble sitting next to the delivered one, with a Réessayer button
  that always errors.
- **Dossier update.** Wrapped in `writeWithTimeout`, so A.3 fails in 15 s instead of
  hanging forever offline.
- **`Section` gained an `error` state** (precedence: loading → error → empty → list),
  threaded through `DossiersSection` / `CompaniesSection`, so a denied or offline read no
  longer reads as "aucun dossier". `ScreenMessage` does the same job for whole screens.
- **`ready` is consumed**: the back-office dashboard, the companies list and the pending
  banner hold their loading state until the saved région hydrates. This also surfaced a
  real race — a région picked inside the hydration window was overwritten by the stored
  value landing afterwards. `useRegionFilter` now tracks `userSet` and the store defers.
- **No screen returns `null` while loading** any more (`AccountScreen`, `DossierChatScreen`).
- The funnels call `alertDialog` instead of `Alert.alert`, which was dead on web.

### Deliberately not done

- **`uploadBytesResumable`.** Real per-file upload progress needs the resumable API; the
  photo funnels and chat attachments still show an indeterminate spinner. Excluded from
  this pass by choice, not oversight.
- **`SettingsList`'s région dropdown** still shows its placeholder for the hydration
  window. There is no spinner idiom for a dropdown, and the underlying overwrite race —
  the part that could actually lose a user's choice — is fixed in the store instead.
- The extra `onSnapshot` fired with `region = null` before hydration is still made; the
  UI just doesn't render its result. Gating the subscribe itself would need a "skip"
  signal in the read hooks.

---

## 6. Keeping this in sync

When the remediation lands, update in the same change:

- `.claude/skills/bike-eco-ui/SKILL.md` — the component table and the "Common mistakes"
  row about re-implementing loading states.
- `.claude/skills/bike-eco-data/SKILL.md` — the hook-shape section, if mutation hooks start
  returning a pending flag.
- `docs/tech/frontend-architecture.md` — its "Read hooks return `{ data, loading }`"
  section, which this audit extends to writes.
