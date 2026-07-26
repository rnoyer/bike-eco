/**
 * Fully deletes a back-office account on the LIVE project — the counterpart to
 * grant-backoffice.js, and the reverse of the three writes it makes.
 *
 * A back-office account owns far less than a b2b one: it has no company, and it
 * cannot submit a dossier (the submission funnel is b2b-only), so there is no
 * Firestore subtree and no Storage prefix hanging off it. What is left behind by
 * a console-only deletion is the `users/{uid}` profile — dead PII no product
 * path can reach again, since a new account on the same address gets a new uid.
 *
 * Removed:
 *   1. the Auth user
 *   2. the `users/{uid}` document
 *
 * Two things it refuses to do, because they are silent, hard-to-diagnose damage:
 *
 *   · **Deleting the last active back-office account.** No product path mints a
 *     `backoffice` identity — `registerCompany` and `sendInvite` are b2b-only.
 *     With none left, no company can ever be validated again: every registration
 *     piles up `pending` and every new dealer sits on the waiting screen, with
 *     nothing in the app to explain why. `--force` overrides, and the recovery is
 *     grant-backoffice.js.
 *   · **Deleting an account that owns dossiers.** It should be impossible, but
 *     grant-backoffice.js reuses an existing Auth user, so a b2b account promoted
 *     to back-office keeps the dossiers it submitted as a dealer. Those need the
 *     b2b cascade (Storage + messages), so the script sends you to
 *     delete-b2b-user.js rather than orphan the files.
 *
 * Self-contained on purpose: single file, one dependency, no repo checkout
 * needed. Run it from Cloud Shell — see docs/ops/manage-accounts.md.
 *
 *   npm i firebase-admin
 *   node delete-backoffice.js --email a@b.fr          # dry run: prints the plan
 *   node delete-backoffice.js --email a@b.fr --yes    # actually deletes
 *
 * Dry run is the default; nothing is written without `--yes`. Options:
 *   --uid <uid>   target by uid (clears a profile whose Auth user is gone)
 *   --force       allow deleting the last active back-office account
 *
 * To only suspend access, don't delete: Firebase console → Authentication →
 * Users → Disable account. Sign-in fails immediately, the claims and profile stay
 * intact, and it is reversible in one click.
 *
 * Credentials come from Application Default Credentials (your own Google login
 * in Cloud Shell). Never commit or download a service-account key for this.
 */
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "bike-eco-43a84";
const DB_ID = "bike-eco-db";

const USAGE =
  "Usage: node delete-backoffice.js (--email <email> | --uid <uid>) [--yes] [--force]";

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

/**
 * Messages this account posted in dossier chats stay, so count them for the
 * plan. Needs a COLLECTION_GROUP index on `messages.senderId`, which
 * firestore.indexes.json does not declare — degrade instead of failing the run
 * over a number that is informational only.
 */
async function countMessages(db, uid) {
  try {
    const snap = await db
      .collectionGroup("messages").where("senderId", "==", uid).count().get();
    return snap.data().count;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = args.yes === true;

  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore(DB_ID);

  const { uid, authUser, profile } = await resolveTarget(auth, db, args);
  const data = profile?.data() ?? {};
  const email = authUser?.email ?? data.email ?? "(email inconnu)";
  // Claims win over the profile doc, as everywhere else (buildSessionUser).
  const role = authUser?.customClaims?.role ?? data.role ?? null;

  if (role !== "backoffice") {
    console.error(
      `${email} has role \`${role ?? "?"}\`, not \`backoffice\` — use ` +
        "delete-b2b-user.js, which also removes its dossiers, files and invitations.",
    );
    process.exit(1);
  }

  const others = (
    await db.collection("users").where("role", "==", "backoffice").get()
  ).docs.filter((d) => d.id !== uid && d.data().status === "active");
  const dossiers = (
    await db.collection("dossiers").where("submittedBy", "==", uid).get()
  ).docs;
  const messages = await countMessages(db, uid);

  // ── plan ───────────────────────────────────────────────────────────────────
  console.log(`\nTarget: ${email}`);
  console.log(`  uid            ${uid}`);
  console.log(`  Auth user      ${authUser ? "present" : "MISSING (already deleted)"}`);
  console.log(`  profile doc    ${profile ? `users/${uid}` : "MISSING"}`);
  console.log(`  role           ${role}`);
  console.log(`  status         ${data.status ?? authUser?.customClaims?.status ?? "?"}`);
  console.log(`  messages       ${messages ?? "non comptés (index absent)"} — conservés`);
  console.log(`  other active back-office accounts: ${others.length}`);
  for (const d of others) console.log(`    · ${d.data().email} (${d.id})`);

  if (dossiers.length) {
    console.error(
      `\nThis account submitted ${dossiers.length} dossier(s) — it was a b2b account ` +
        "before being promoted. Deleting it here would leave their photos and " +
        "attachments in Storage with nothing pointing at them.\n" +
        "Use delete-b2b-user.js instead: it removes the dossiers, their messages " +
        "and their files first.",
    );
    process.exit(1);
  }

  if (others.length === 0 && args.force !== true) {
    console.error(
      "\nThis is the LAST active back-office account. Deleting it leaves nobody " +
        "able to validate a company: every registration stays `pending` and every " +
        "new dealer waits forever, with nothing in the app explaining why.\n" +
        "Create the replacement first (grant-backoffice.js), or pass --force if " +
        "that is really what you want.",
    );
    process.exit(1);
  }

  if (!apply) {
    console.log("\nDry run — nothing deleted. Re-run with --yes to apply.");
    return;
  }

  // ── apply ──────────────────────────────────────────────────────────────────
  // Auth first, then the profile: while either exists the account is findable,
  // so an interrupted run is always re-runnable.
  await auth.deleteUser(uid).catch((err) => {
    if (err?.code !== "auth/user-not-found") throw err;
  });
  if (profile) await db.collection("users").doc(uid).delete();

  console.log(`\nBack-office account ${email} (uid ${uid}) fully deleted.`);
  if (others.length === 0) {
    console.log(
      "No active back-office account remains — run grant-backoffice.js before " +
        "the next company registration needs validating.",
    );
  }
  console.log(
    "Messages they posted in dossier chats are untouched — they carry a " +
      "denormalized `senderName`, and removing them would gut the conversation " +
      "for the dealer.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
