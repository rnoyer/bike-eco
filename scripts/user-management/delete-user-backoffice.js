/**
 * Fully deletes a back-office account on the LIVE project — the counterpart to
 * grant-backoffice.js, and the reverse of the three writes it makes. b2b accounts
 * go through delete-b2b-user.js instead; this script refuses them.
 *
 * Options
 *   --email <email>   target by address — the Auth user, or a leftover profile
 *                     carrying that email when the Auth user is already gone
 *   --uid <uid>       target by uid (one of --email / --uid is required)
 *   --yes             apply; without it the run is a dry run that prints the
 *                     plan and writes nothing
 *   --force           allow deleting the LAST active back-office account, which
 *                     the script otherwise refuses to do
 *
 * Run it from Cloud Shell — see docs/ops/manage-accounts.md. Credentials come
 * from Application Default Credentials (your own Google login there); never
 * commit or download a service-account key for this.
 *
 *   npm i firebase-admin
 *   node delete-backoffice.js --email a@b.fr          # dry run: prints the plan
 *   node delete-backoffice.js --email a@b.fr --yes    # actually deletes
 *
 * What it does, in this order
 *   1. the invitations this account sent, and any pending one addressed to its
 *      email — a leftover invitation stays redeemable for up to an hour and
 *      would mint a back-office member after the admin who sent it is gone
 *   2. the Auth user
 *   3. the `users/{uid}` document and its `pushTokens` subcollection
 *
 *   Auth and the profile go last, so the account stays findable and a run cut
 *   short is always re-runnable.
 *
 * It refuses three things, and exits without writing:
 *   · an account whose role is not `backoffice`
 *   · an account that submitted dossiers — a b2b account promoted to back-office
 *     keeps them, and they need the b2b cascade (Storage + messages)
 *   · the last active back-office account, unless --force: with none left, no
 *     company can be validated and no replacement can be invited, so every
 *     registration piles up `pending` with nothing in the app explaining why.
 *     The recovery is grant-backoffice.js, the one path that needs no admin.
 *
 * What it does not do
 *   · nothing here is recoverable — no undo, and a new account on the same email
 *     gets a new uid
 *   · leaves the messages this account posted in dossier chats: they carry a
 *     denormalized `senderName`, and removing them would gut the conversation
 *     for the dealer
 *   · does not merely suspend — for reversible, one-click suspension use the
 *     Firebase console → Authentication → Users → Disable account, which leaves
 *     the claims and the profile intact
 *   · does not touch companies, security rules, indexes or functions
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
  const sentInvites = (
    await db.collection("invitations").where("invitedBy", "==", uid).get()
  ).docs;
  // A pending invitation to this account's own email — e.g. it never accepted
  // one sent before it existed by another route — stays redeemable otherwise.
  const receivedInvites = authUser?.email || data.email
    ? (await db.collection("invitations")
        .where("email", "==", authUser?.email ?? data.email).get()).docs
    : [];

  // ── plan ───────────────────────────────────────────────────────────────────
  console.log(`\nTarget: ${email}`);
  console.log(`  uid            ${uid}`);
  console.log(`  Auth user      ${authUser ? "present" : "MISSING (already deleted)"}`);
  console.log(`  profile doc    ${profile ? `users/${uid}` : "MISSING"}`);
  console.log(`  role           ${role}`);
  console.log(`  status         ${data.status ?? authUser?.customClaims?.status ?? "?"}`);
  console.log(`  messages       ${messages ?? "non comptés (index absent)"} — conservés`);
  console.log(`  invitations    ${sentInvites.length} envoyée(s), ${receivedInvites.length} reçue(s) — supprimées`);
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
  // Invitations first — a pending one stays redeemable through acceptInvite
  // for up to an hour, so it must not survive the account that could still
  // vouch for it. Auth and the profile go last: while either exists the
  // account is findable, so an interrupted run is always re-runnable.
  await Promise.all(
    [...sentInvites, ...receivedInvites].map((d) => d.ref.delete()),
  );
  await auth.deleteUser(uid).catch((err) => {
    if (err?.code !== "auth/user-not-found") throw err;
  });
  // Recursive: the profile owns a `pushTokens` subcollection, and a plain
  // document delete would leave the device tokens behind as personal data
  // no product path can reach again.
  if (profile) await db.recursiveDelete(db.collection("users").doc(uid));

  console.log(
    `\nBack-office account ${email} (uid ${uid}) fully deleted, along with ` +
      `${sentInvites.length + receivedInvites.length} invitation(s).`,
  );
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
