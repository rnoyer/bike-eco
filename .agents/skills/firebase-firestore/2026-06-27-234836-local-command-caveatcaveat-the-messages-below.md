▐▛███▜▌ Claude Code v2.1.191
▝▜█████▛▘ Opus 4.8 · Claude Pro
▘▘ ▝▝ ~/Code/bike-eco/.agents/skills/firebase-firestore

❯ lets now build the Firestore data model using all of the information and  
 context given in @docs/ I need to know the steps and the whoel schema.  
 Starting with the needed steps  
 ⎿  Listed directory docs/

● This is Firestore work — let me read the full product doc first, then pull in
the Firestore skill (required for any Firestore design work).

Read 1 file (ctrl+o to expand)

● Now I'll activate the Firestore skill (required for this work) and read the
B2B form specs in full to capture every field the data model must hold.

● Skill(firebase-firestore)
⎿  Successfully loaded skill

Read 3 files (ctrl+o to expand)

● Before I lay out the plan, let me check the current Firebase state of the
project so the steps are accurate.

Ran 1 shell command (ctrl+o to expand)

● Firebase project exists (bike-eco-641ed), SDK installed, Functions configured
— but no Firestore block in firebase.json yet. Per the skill, let me detect
the Firestore instance/edition.

Ran 1 shell command (ctrl+o to expand)

● Two Standard-edition Firestore databases exist: (default) and bike-eco-db.
I'll follow the Standard guides. Let me read the relevant ones (data model
conventions live in security rules + indexes for Standard).

Read 2 files, ran 1 shell command (ctrl+o to expand)

● Let me check how Firestore is currently wired in the app config.

Read 1 file (ctrl+o to expand)

● I've got everything I need — the product doc, all four form specs, and the
current Firebase setup. Here's the picture:

- Firebase project bike-eco-641ed, SDK v12 installed, Functions configured,
  Storage initialized — but Firestore is not yet wired into firebaseConfig.js
  and there's no firestore block in firebase.json.
- Two Standard-edition databases exist: (default) and bike-eco-db.

Below is the full plan (steps first, as you asked) then the complete schema.

---

A. Build steps (roadmap)

1. Pick the target database & enable Firestore in the app — choose (default)
   or bike-eco-db, then add getFirestore(app, "<db>") to firebaseConfig.js
   (currently only Storage is initialized).
2. Add Auth — the B2B/back-office paths need Firebase Auth (email/password +
   Google). Roles (b2b / backoffice) and companyId should live in custom claims,
   set server-side — never client-writable (the security-rules guide is emphatic:
   users must never set their own role).
3. Define schema as code — TS interfaces + Firestore converters, co-located
   with the existing Zod schemas in src/features/\*. The funnel's
   B2cSubmissionForm maps into the dossier shape on submit (string→number
   conversions for prix, annee, etc.).
4. Wire config files — add a firestore block to firebase.json pointing at
   firestore.rules and firestore.indexes.json; create both.
5. Security rules — default-deny, role/ownership-based, with per-collection
   validators (Phase 1–4 of the rules guide, including the devil's-advocate
   pass). Prototype first, then harden.
6. Cloud Functions for the writes that can't be direct client writes:


    - B2C submission (callable/HTTPS) — the funnel is unauthenticated, so it

can't write to Firestore under default-deny rules. A Function validates,
creates the dossier, uploads photos, and sends the two emails routed
NORTH/SOUTH (→ romain.noyer@gmail.com in dev). - B2B invitation — generate a one-time, time-limited token and email the
registration link. - onDossierCreate (B2B) — notify the right team mailbox. - Company/user validation — flips status to active and sets custom claims
after manual approval. 7. Composite indexes for the dashboard queries (section D). 8. Validate on the emulator with seed data, then integrate the app screens
(dashboard queries, dossier page, chat listeners, submission wiring).

---

B. The full schema

Five collections + one subcollection. Nested maps group the form sections for
readability; dates are timestamp; prix/annee/kilometrage/cylindree are number.

companies/{companyId}

┌───────────┬───────────┬─────────────────────────────────────────────────┐
│ field │ type │ notes │
├───────────┼───────────┼─────────────────────────────────────────────────┤
│ siret │ string │ 14 digits, immutable │
├───────────┼───────────┼─────────────────────────────────────────────────┤
│ name │ string │ │
├───────────┼───────────┼─────────────────────────────────────────────────┤
│ status │ string │ pending → active / rejected (manual validation) │
├───────────┼───────────┼─────────────────────────────────────────────────┤
│ createdBy │ uid │ first registrant │
├───────────┼───────────┼─────────────────────────────────────────────────┤
│ createdAt │ timestamp │ immutable │
└───────────┴───────────┴─────────────────────────────────────────────────┘

users/{uid} (PII → owner + team read only)

┌───────────────────┬─────────────┬───────────────────────────────────────┐
│ field │ type │ notes │
├───────────────────┼─────────────┼───────────────────────────────────────┤
│ role │ string │ b2b | backoffice — mirror of custom │
│ │ │ claim, server-set │
├───────────────────┼─────────────┼───────────────────────────────────────┤
│ companyId │ string|null │ b2b only │
├───────────────────┼─────────────┼───────────────────────────────────────┤
│ region │ string|null │ NORTH|SOUTH (back-office routing) │
├───────────────────┼─────────────┼───────────────────────────────────────┤
│ nom, prenom │ string │ │
├───────────────────┼─────────────┼───────────────────────────────────────┤
│ email, telephone │ string │ PII │
├───────────────────┼─────────────┼───────────────────────────────────────┤
│ departement, │ string │ │
│ ville │ │ │
├───────────────────┼─────────────┼───────────────────────────────────────┤
│ status │ string │ pending until company validated → │
│ │ │ active │
├───────────────────┼─────────────┼───────────────────────────────────────┤
│ createdAt, │ timestamp │ │
│ updatedAt │ │ │
└───────────────────┴─────────────┴───────────────────────────────────────┘

invitations/{invitationId}

┌───────────┬───────────┬─────────────────────────────────┐
│ field │ type │ notes │
├───────────┼───────────┼─────────────────────────────────┤
│ email │ string │ invitee │
├───────────┼───────────┼─────────────────────────────────┤
│ companyId │ string │ │
├───────────┼───────────┼─────────────────────────────────┤
│ invitedBy │ uid │ │
├───────────┼───────────┼─────────────────────────────────┤
│ tokenHash │ string │ store a hash, not the raw token │
├───────────┼───────────┼─────────────────────────────────┤
│ status │ string │ pending | accepted | expired │
├───────────┼───────────┼─────────────────────────────────┤
│ expiresAt │ timestamp │ one-time, time-limited │
├───────────┼───────────┼─────────────────────────────────┤
│ createdAt │ timestamp │ │
└───────────┴───────────┴─────────────────────────────────┘

dossiers/{dossierId} (the core entity — unifies B2C + B2B via source)

┌──────────────────┬─────────────┬────────────────────────────────────────┐
│ field │ type │ notes │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ source │ string │ b2c | b2b │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ status │ string │ a_traiter | en_cours | cloture │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ region │ string │ NORTH|SOUTH, derived from departement │
│ │ │ (reuses isNord/isSud) │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ companyId │ string|null │ b2b │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ submittedBy │ uid|null │ b2b │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ assignedTo │ uid|null │ team member handling it │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ │ │ {nom, prenom, email, telephone, │
│ contact │ map │ departement, ville} (B2C from form; │
│ │ │ B2B from account) │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ │ │ {electrique, materiel[], marque, │
│ vehicle │ map │ modele, cylindree, annee, kilometrage, │
│ │ │ accessoires} │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ keys │ map │ {aClesContact, cleNoire, cleMarron, │
│ │ │ cleRouge, aTelecommande, telecommande} │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ condition │ map │ {etat, naturePanne} │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ │ │ {carteGrise, carteGriseAVotreNom, │
│ papers │ map │ controleTechnique, ctMoins6Mois, │
│ │ │ resultatCT, certificatNonGage, │
│ │ │ carnetEntretien, factureEntretien} │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ pricing │ map │ {prix, commentaires} │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ pickup │ map │ {modalite} (B2C only) │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ photos │ string[] │ Storage download URLs │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ thumbnailUrl │ string │ low-res first photo (card spec) │
├──────────────────┼─────────────┼────────────────────────────────────────┤
│ createdAt, │ │ │
│ updatedAt, │ timestamp │ createdAt orders the dashboards │
│ lastMessageAt │ │ │
└──────────────────┴─────────────┴────────────────────────────────────────┘

Status → dashboard mapping: back office splits a_traiter / en_cours / cloture;
the B2B "Dossiers en cours" = status in ['a_traiter','en_cours'], "Dossiers
clos" = cloture.

dossiers/{dossierId}/messages/{messageId} (one chat per dossier, B2B ↔ team)

┌─────────────┬────────────┬───────────────────────────────────────────────┐
│ field │ type │ notes │
├─────────────┼────────────┼───────────────────────────────────────────────┤
│ senderId │ uid │ │
├─────────────┼────────────┼───────────────────────────────────────────────┤
│ senderName │ string │ denormalized: "[name] - [company]" or "[name] │
│ │ │ - Bike-eco" │
├─────────────┼────────────┼───────────────────────────────────────────────┤
│ senderRole │ string │ b2b | backoffice │
├─────────────┼────────────┼───────────────────────────────────────────────┤
│ text │ string │ │
├─────────────┼────────────┼───────────────────────────────────────────────┤
│ attachments │ array<map> │ {type:'image'|'pdf', url, name, size} │
├─────────────┼────────────┼───────────────────────────────────────────────┤
│ createdAt │ timestamp │ orders the thread │
└─────────────┴────────────┴───────────────────────────────────────────────┘

Storage layout: dossiers/{dossierId}/photos/_ and dossiers/{dossierId}/chat/_.

---

C. Query patterns → composite indexes

- B2B dashboard: where(companyId ==) + where(status in) + orderBy(createdAt
  desc) → (companyId, status, createdAt)
- Back office: where(region ==) + where(status ==) + orderBy(createdAt desc) →
  (region, status, createdAt)
- Chat: messages orderBy(createdAt) → automatic single-field.

---

D. Access control (summary)

- dossiers — read: B2B users where companyId == their claim; team where region
  matches. Create: B2B authed user (b2b) / Function (b2c). Update: team (status
  transitions) — combined with field validation, never ownership-only.
- companies/users — owner + team; PII locked to owner. role/companyId/status
  server-set only.
- invitations/messages — scoped to the company members + team involved.

---

Two decisions drive the next step. Everything else I can proceed on with the
recommendations above.

● User answered Claude's questions:
⎿  · Which Firestore database should this data model target? → bike-eco-db
· How should the unauthenticated B2C funnel submit a dossier? → Emails
only, no storage

● Locked in: target bike-eco-db, and B2C = emails only (not persisted). That
second choice meaningfully simplifies the model — here's the impact.

What changes

The dossiers collection is now B2B-only. B2C never touches Firestore, which
means:

- Drop the source discriminator and the full contact PII map. companyId +
  submittedBy are always present.
- For the card/dossier displays, denormalize just the display bits the
  dashboards need (per the rules guide's preference) instead of a full contact
  block:

dossiers/{dossierId} (revised)

┌────────────────────────┬───────────────────┬────────────────────────────┐
│ field │ type │ notes │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ status │ string │ a_traiter | en_cours | │
│ │ │ cloture │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ region │ string │ NORTH|SOUTH, derived from │
│ │ │ departement │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ companyId │ string │ owner company │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ submittedBy │ uid │ │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ assignedTo │ uid|null │ team member │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ │ │ denormalized display: │
│ submitter │ map │ {nom, prenom, companyName} │
│ │ │ (for cards/chat) │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ vehicle / keys / │ │ │
│ condition / papers / │ map │ as before │
│ pricing │ │ │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ │ string[] · │ │
│ photos │ thumbnailUrl │ Storage │
│ │ string │ │
├────────────────────────┼───────────────────┼────────────────────────────┤
│ createdAt / updatedAt │ timestamp │ │
│ / lastMessageAt │ │ │
└────────────────────────┴───────────────────┴────────────────────────────┘

▎ Note: the B2B form has no pickup/modalite step (that's B2C-only) and merges
▎ "Modèle et Cylindrée" into one field — so vehicle.modalite is gone and
▎ vehicle.modele may carry the cylindrée. Everything else in
▎ vehicle/keys/condition/papers/pricing matches the B2B spec.

Companies / users / invitations / messages: unchanged from section B.

B2C collapses to a single Cloud Function: validate → send the two NORTH/SOUTH
emails (→ romain.noyer@gmail.com in dev). No Firestore, no Storage, no
unauthenticated-write path — so every Firestore rule can require auth, which
keeps the rules much tighter.

Revised steps

1. getFirestore(app, "bike-eco-db") in firebaseConfig.js.
2. Firebase Auth + custom claims (role, companyId) — server-set.
3. Schema-as-code (TS interfaces + converters) for the 5 collections.
4. firestore block in firebase.json → firestore.rules + firestore.indexes.json
   (targeting bike-eco-db).
5. Security rules (fully authenticated, role/ownership + validators,
   devil's-advocate pass).
6. Cloud Functions: B2C email-only, B2B invitation, onDossierCreate notify,
   company/user validation.
7. Composite indexes: (companyId, status, createdAt) and (region, status,
   createdAt).
8. Emulator validation + app integration.

That's the complete plan and schema reflecting both decisions. Want me to
start with step 1 (wire bike-eco-db into firebaseConfig.js and scaffold the
schema-as-code in step 3), or would you rather I lay out the security rules /
Functions in detail first?

✻ Cogitated for 3m 41s

❯ /export  
 ⎿ Conversation copied to clipboard
