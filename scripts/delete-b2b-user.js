/**
 * Fully deletes a b2b (vendeur) account on the LIVE project — every trace of it,
 * not just the Auth record. Back-office accounts own no company data and go
 * through `delete-backoffice.js` instead; this script refuses them.
 *
 * Deleting the Auth user alone (what the Firebase console offers) leaves the
 * `users/{uid}` profile, the dossiers they submitted, those dossiers' photos and
 * message attachments in Storage, and any invitation they sent or received. The
 * profile doc is the visible one: a fresh account on the same email gets a new
 * uid, so the old doc is unreachable dead PII.
 *
 * Removed, in the order deleteCompanyCore uses (Storage first, so a failure
 * mid-run can never orphan files no document points at):
 *
 *   1. Storage under `dossiers/{companyId}/{dossierId}/` for each dossier
 *   2. those dossiers and their `messages` and `mutes` subcollections
 *   3. invitations they sent (`invitedBy`) and any pending invite to their email
 *   4. the Auth user
 *   5. the `users/{uid}` document and its `pushTokens` subcollection
 *
 * Self-contained on purpose: single file, one dependency, no repo checkout
 * needed. Run it from Cloud Shell — see docs/ops/manage-accounts.md.
 *
 *   npm i firebase-admin
 *   node delete-b2b-user.js --email a@b.fr            # dry run: prints the plan
 *   node delete-b2b-user.js --email a@b.fr --yes      # actually deletes
 *
 * Dry run is the default; nothing is written without `--yes`. Options:
 *   --uid <uid>        target by uid (repairs a profile whose Auth user is gone)
 *   --keep-dossiers    leave the dossiers to the company (see below)
 *   --with-company     also delete the company, its other members, and all of
 *                      its dossiers — same cascade as the back-office
 *                      "Supprimer l'entreprise" action
 *
 * Dossiers belong to a company, not to a person, but they carry the submitter's
 * name and their photos are company data. The default deletes the ones this user
 * submitted (that is what "fully delete the account" means for GDPR erasure);
 * `--keep-dossiers` keeps them for the remaining team, at the cost of a
 * `submittedBy` pointing at a uid that no longer exists — harmless for reads,
 * since `submitter` is denormalized on the dossier.
 *
 * Credentials come from Application Default Credentials (your own Google login
 * in Cloud Shell). Never commit or download a service-account key for this.
 */
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");

const PROJECT_ID = "bike-eco-43a84";
const DB_ID = "bike-eco-db";
const BUCKET = "bike-eco-43a84.firebasestorage.app";

const USAGE =
  "Usage: node delete-b2b-user.js (--email <email> | --uid <uid>) [--yes]\n" +
  "         [--keep-dossiers] [--with-company]";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const next = argv[i + 1];
    // Bare switches take no value; `--yes --email x` must not swallow "--email".
    args[flag.slice(2)] = next && !next.startsWith("--") ? next : true;
  }
  if (!args.email && !args.uid) {
    console.error(`Missing --email or --uid\n\n${USAGE}`);
    process.exit(1);
  }
  return args;
}

/** Auth user and profile doc can each exist without the other; find both. */
async function resolveTarget(auth, db, args) {
  let authUser = null;
  if (args.uid && args.uid !== true) {
    authUser = await auth.getUser(args.uid).catch(() => null);
  } else {
    authUser = await auth.getUserByEmail(args.email).catch(() => null);
  }

  let uid = authUser?.uid ?? (args.uid !== true ? args.uid : null);
  let profile = uid ? await db.collection("users").doc(uid).get() : null;

  // Targeted by email with no Auth user: the profile may still be there under a
  // uid we don't know yet. This is the exact leftover the script exists to clear.
  if (!uid && args.email) {
    const byEmail = await db
      .collection("users").where("email", "==", args.email).limit(1).get();
    if (!byEmail.empty) {
      profile = byEmail.docs[0];
      uid = profile.id;
    }
  }

  if (!uid) {
    console.error(
      `Nothing found for ${args.email || args.uid} — no Auth user, no profile. ` +
        "Already deleted, or wrong project.",
    );
    process.exit(1);
  }
  return { uid, authUser, profile: profile?.exists ? profile : null };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = args.yes === true;

  initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
  const auth = getAuth();
  const db = getFirestore(DB_ID);
  const bucket = getStorage().bucket();

  const { uid, authUser, profile } = await resolveTarget(auth, db, args);
  const data = profile?.data() ?? {};
  const email = authUser?.email ?? data.email ?? "(email inconnu)";
  const companyId = data.companyId ?? authUser?.customClaims?.companyId ?? null;

  // Claims win over the profile doc, as everywhere else (buildSessionUser).
  const role = authUser?.customClaims?.role ?? data.role ?? null;
  if (role === "backoffice") {
    console.error(
      `${email} is a back-office account — use delete-backoffice.js, which knows ` +
        "not to delete the last one standing.",
    );
    process.exit(1);
  }

  const dossiers = (
    await db.collection("dossiers").where("submittedBy", "==", uid).get()
  ).docs;
  const sentInvites = (
    await db.collection("invitations").where("invitedBy", "==", uid).get()
  ).docs;
  const receivedInvites = authUser?.email || data.email
    ? (await db.collection("invitations")
        .where("email", "==", authUser?.email ?? data.email).get()).docs
    : [];
  const teammates = companyId
    ? (await db.collection("users").where("companyId", "==", companyId).get()).docs
    : [];

  // ── plan ───────────────────────────────────────────────────────────────────
  console.log(`\nTarget: ${email}`);
  console.log(`  uid          ${uid}`);
  console.log(`  Auth user    ${authUser ? "present" : "MISSING (already deleted)"}`);
  console.log(`  profile doc  ${profile ? `users/${uid}` : "MISSING"}`);
  console.log(`  role         ${role ?? "?"}`);
  console.log(`  company      ${companyId ?? "—"}`);
  console.log(
    `  dossiers     ${dossiers.length}` +
      (dossiers.length && args["keep-dossiers"] ? " (kept: --keep-dossiers)" : ""),
  );
  console.log(`  invitations  ${sentInvites.length} sent, ${receivedInvites.length} to this email`);

  const cascadeCompany = args["with-company"] === true && companyId;
  if (cascadeCompany) {
    const companySnap = await db.collection("companies").doc(companyId).get();
    console.log(
      `\n--with-company: deleting ${companyId} ` +
        `(${companySnap.data()?.name ?? "introuvable"}), its ${teammates.length} ` +
        "member(s), and every dossier + file it owns.",
    );
    for (const t of teammates) console.log(`    · ${t.data().email} (${t.id})`);
  } else if (companyId && teammates.length <= 1) {
    console.log(
      `\nNote: this is the last member of company ${companyId}. The company doc ` +
        "survives with no one able to sign in for it — pass --with-company to " +
        "remove it too, or delete it from the back-office.",
    );
  } else if (companyId && role === "b2b" &&
    (await db.collection("companies").doc(companyId).get()).data()?.createdBy === uid) {
    console.log(
      `\nNote: company ${companyId} keeps \`createdBy: ${uid}\`, now dangling. ` +
        "Display-only (the card shows `createdByName`), no action needed.",
    );
  }

  if (!apply) {
    console.log("\nDry run — nothing deleted. Re-run with --yes to apply.");
    return;
  }

  // ── apply ──────────────────────────────────────────────────────────────────
  if (cascadeCompany) {
    // Same order as deleteCompanyCore (functions/src/registration/backoffice.ts):
    // storage, dossiers, users, invitations, company. Storage is company-
    // prefixed, so one prefixed delete covers every photo, thumbnail and
    // attachment; invitations go before the company doc so an outstanding invite
    // can never outlive the company it points at.
    await bucket.deleteFiles({ prefix: `dossiers/${companyId}/` });
    const owned = await db.collection("dossiers").where("companyId", "==", companyId).get();
    await Promise.all(owned.docs.map((d) => db.recursiveDelete(d.ref)));
    await Promise.all(teammates.map(async (doc) => {
      await auth.deleteUser(doc.id).catch((err) => {
        if (err?.code !== "auth/user-not-found") throw err;
      });
      // Recursive: `users/{uid}/pushTokens` would otherwise outlive the account.
      await db.recursiveDelete(doc.ref);
    }));
    const invites = await db.collection("invitations").where("companyId", "==", companyId).get();
    await Promise.all(invites.docs.map((d) => d.ref.delete()));
    await db.collection("companies").doc(companyId).delete();
    console.log(
      `\nDeleted company ${companyId}: ${owned.size} dossier(s), ` +
        `${teammates.length} account(s), ${invites.size} invitation(s), and its files.`,
    );
  } else {
    if (!args["keep-dossiers"]) {
      for (const doc of dossiers) {
        // Use the dossier's own companyId: the profile's may be stale, and a
        // wrong prefix would silently leave the files behind.
        const prefix = `dossiers/${doc.data().companyId}/${doc.id}/`;
        await bucket.deleteFiles({ prefix });
        await db.recursiveDelete(doc.ref); // dossier + its `messages` and `mutes` subcollections
        console.log(`Deleted dossier ${doc.id} and ${prefix}*`);
      }
    }
    await Promise.all(
      [...sentInvites, ...receivedInvites].map((d) => d.ref.delete()),
    );
  }

  // The Auth user and the profile doc go last, in both branches: while they
  // exist the account is findable, so an interrupted run is always re-runnable.
  await auth.deleteUser(uid).catch((err) => {
    if (err?.code !== "auth/user-not-found") throw err;
  });
  // Recursive: the profile owns a `pushTokens` subcollection, and a plain
  // document delete would leave this device's token behind as personal data
  // no product path can reach again.
  if (profile) await db.recursiveDelete(db.collection("users").doc(uid));

  console.log(`\nAccount ${email} (uid ${uid}) fully deleted.`);
  console.log(
    "Messages they posted in other companies' dossiers are untouched — they " +
      "carry a denormalized `senderName`, and removing them would gut the " +
      "conversation for the other party.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
