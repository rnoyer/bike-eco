/**
 * Erases **all** application data on the LIVE project: every Storage object,
 * every Firestore document in `bike-eco-db`, and every Auth user. This is the
 * "start again from an empty project" button — a pre-launch reset, not an
 * account-management tool. To remove one person, use `delete-b2b-user.js` or
 * `delete-backoffice.js`, which know what a single account owns.
 *
 * Nothing here is recoverable. Firestore has no undo, Storage has no version
 * history on this bucket, and deleted Auth users cannot be restored (a new
 * account on the same email gets a new uid, so every `submittedBy`,
 * `invitedBy` and `senderName` in any surviving copy points nowhere).
 *
 * Deleted, in that order — Storage first, so an interrupted run can never
 * leave files no document points at, and Auth last, so accounts stay findable
 * and the run stays re-runnable:
 *
 *   1. every object in the bucket (all of it is `dossiers/{companyId}/…`)
 *   2. every document of every top-level Firestore collection, with their
 *      subcollections (`messages`, `mutes`, `pushTokens`)
 *   3. every Auth user, in batches
 *
 * Self-contained on purpose: single file, one dependency, no repo checkout
 * needed. Run it from Cloud Shell — see docs/ops/wipe-prod.md.
 *
 *   npm i firebase-admin
 *   node wipe-prod.js                                    # dry run: prints the plan
 *   node wipe-prod.js --yes --confirm bike-eco-43a84     # actually erases everything
 *
 * Dry run is the default, and `--yes` alone is not enough: `--confirm` must
 * spell out the project id, so a wipe can never be a recalled shell command
 * away. Options:
 *   --only <list>       any of `storage,firestore,auth` (default: all three)
 *   --keep-backoffice   keep the back-office accounts — their Auth user, their
 *                       `users/{uid}` document and its `pushTokens`
 *   --keep <emails>     same, for a comma-separated list of addresses
 *
 * Keeping nothing leaves a project with no way in: no product path creates a
 * back-office account, so signing in again means running `grant-backoffice.js`
 * (docs/ops/first-backoffice-account.md). `--keep-backoffice` is the usual
 * choice for a data reset that keeps the team's logins.
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

const TARGETS = ["storage", "firestore", "auth"];
/** `deleteUsers` takes at most 1000 uids and is server-limited to ~1 QPS. */
const AUTH_BATCH = 1000;

const USAGE =
  "Usage: node wipe-prod.js [--only storage,firestore,auth]\n" +
  "         [--keep-backoffice] [--keep a@b.fr,c@d.fr]\n" +
  `         [--yes --confirm ${PROJECT_ID}]`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const next = argv[i + 1];
    // Bare switches take no value; `--yes --only x` must not swallow "--only".
    args[flag.slice(2)] = next && !next.startsWith("--") ? next : true;
  }

  const only = args.only === true || args.only === undefined
    ? TARGETS
    : String(args.only).split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = only.filter((t) => !TARGETS.includes(t));
  if (unknown.length) {
    console.error(`Unknown --only target(s): ${unknown.join(", ")}\n\n${USAGE}`);
    process.exit(1);
  }

  const keepEmails = args.keep === true || args.keep === undefined
    ? []
    : String(args.keep).split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

  // `--yes` alone never deletes: erasing a whole project is worth typing out.
  const apply = args.yes === true;
  if (apply && args.confirm !== PROJECT_ID) {
    console.error(
      `--yes requires --confirm ${PROJECT_ID} (got ${
        args.confirm === undefined ? "nothing" : `"${args.confirm}"`
      }).\n\n${USAGE}`,
    );
    process.exit(1);
  }

  return {
    apply,
    only,
    keepEmails,
    keepBackoffice: args["keep-backoffice"] === true,
  };
}

/** Every Auth user, with the claims that decide whether it is kept. */
async function listAllUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(AUTH_BATCH, pageToken);
    users.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

/** Counts objects without holding the whole bucket listing in memory. */
async function countObjects(bucket) {
  let total = 0;
  let query = { autoPaginate: false, maxResults: 1000 };
  for (;;) {
    const [files, nextQuery] = await bucket.getFiles(query);
    total += files.length;
    if (!nextQuery) return total;
    query = nextQuery;
  }
}

/** Aggregate count, falling back to a full read where it is unavailable. */
async function countDocs(colRef) {
  try {
    return (await colRef.count().get()).data().count;
  } catch {
    return (await colRef.get()).size;
  }
}

async function main() {
  const { apply, only, keepEmails, keepBackoffice } = parseArgs(process.argv.slice(2));

  initializeApp({ projectId: PROJECT_ID, storageBucket: BUCKET });
  const auth = getAuth();
  const db = getFirestore(DB_ID);
  const bucket = getStorage().bucket();

  // Emulator hosts are honoured by the SDK from the environment; say which one
  // we are pointed at, so a rehearsal is never mistaken for the real thing.
  const emulated = Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST ||
      process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  );

  const users = await listAllUsers(auth);
  const kept = users.filter(
    (u) =>
      (keepBackoffice && u.customClaims?.role === "backoffice") ||
      (u.email && keepEmails.includes(u.email.toLowerCase())),
  );
  const keptUids = new Set(kept.map((u) => u.uid));
  const missingKeeps = keepEmails.filter(
    (e) => !kept.some((u) => u.email?.toLowerCase() === e),
  );

  const collections = only.includes("firestore") ? await db.listCollections() : [];
  const counts = await Promise.all(collections.map((c) => countDocs(c)));
  const objectCount = only.includes("storage") ? await countObjects(bucket) : 0;

  // ── plan ───────────────────────────────────────────────────────────────────
  console.log(`\n${emulated ? "EMULATORS" : "LIVE PROJECT"}: ${PROJECT_ID}`);
  console.log(`  database     ${DB_ID}`);
  console.log(`  bucket       ${BUCKET}`);
  console.log(`  wiping       ${only.join(", ")}`);

  if (only.includes("storage")) {
    console.log(`\nStorage: ${objectCount} object(s) — the whole bucket.`);
  }
  if (only.includes("firestore")) {
    console.log(`\nFirestore: ${collections.length} top-level collection(s)`);
    collections.forEach((c, i) => {
      const spared = c.id === "users" && keptUids.size
        ? ` (keeping ${keptUids.size})`
        : "";
      console.log(`    · ${c.id.padEnd(12)} ${counts[i]} doc(s)${spared}`);
    });
    if (!collections.length) console.log("    (already empty)");
  }
  if (only.includes("auth")) {
    console.log(`\nAuth: ${users.length} user(s), ${keptUids.size} kept`);
    for (const u of kept) {
      console.log(`    · keeping ${u.email ?? u.uid} (${u.customClaims?.role ?? "no role"})`);
    }
  }

  if (missingKeeps.length) {
    console.error(
      `\nRefusing to run: no Auth user for --keep ${missingKeeps.join(", ")}. ` +
        "A typo here silently deletes the account you meant to save.",
    );
    process.exit(1);
  }

  const keptB2b = kept.filter((u) => u.customClaims?.role !== "backoffice");
  if (keptB2b.length && only.includes("firestore")) {
    console.log(
      `\nNote: ${keptB2b.length} kept account(s) are not back-office — their ` +
        "`companyId` claim will point at a company that no longer exists, and " +
        "the app will treat them as having no company.",
    );
  }
  if (!keptUids.size && only.includes("auth")) {
    console.log(
      "\nNote: no account is kept. Nobody will be able to sign in — no product " +
        "path creates a back-office account. Run `grant-backoffice.js` " +
        "afterwards (docs/ops/first-backoffice-account.md), or re-run with " +
        "--keep-backoffice.",
    );
  }

  if (!apply) {
    console.log(
      `\nDry run — nothing deleted. To apply:\n` +
        `  node wipe-prod.js${process.argv.slice(2).length ? " " + process.argv.slice(2).join(" ") : ""}` +
        ` --yes --confirm ${PROJECT_ID}`,
    );
    return;
  }

  // ── apply ──────────────────────────────────────────────────────────────────
  if (only.includes("storage")) {
    // `force` keeps going past a single object's failure and reports at the end,
    // rather than aborting the wipe partway through the listing.
    await bucket.deleteFiles({ force: true });
    console.log(`\nDeleted ${objectCount} Storage object(s).`);
  }

  if (only.includes("firestore")) {
    for (const col of collections) {
      // The whole collection at once, unless some users must survive: their
      // documents (and `pushTokens`) have to be stepped over one by one.
      if (col.id === "users" && keptUids.size) {
        const docs = (await col.get()).docs.filter((d) => !keptUids.has(d.id));
        for (const doc of docs) await db.recursiveDelete(doc.ref);
        console.log(`Deleted ${docs.length} doc(s) from users (kept ${keptUids.size}).`);
      } else {
        // Recursive: subcollections (`messages`, `mutes`, `pushTokens`) do not
        // go with their parent document.
        await db.recursiveDelete(col);
        console.log(`Deleted collection ${col.id}.`);
      }
    }
  }

  if (only.includes("auth")) {
    const uids = users.map((u) => u.uid).filter((uid) => !keptUids.has(uid));
    let failures = 0;
    for (let i = 0; i < uids.length; i += AUTH_BATCH) {
      const result = await auth.deleteUsers(uids.slice(i, i + AUTH_BATCH));
      failures += result.failureCount;
      for (const err of result.errors) {
        console.error(`  auth ${uids[i + err.index]}: ${err.error.message}`);
      }
    }
    console.log(
      `\nDeleted ${uids.length - failures} Auth user(s)` +
        (failures ? `, ${failures} failed (re-run to retry).` : "."),
    );
  }

  console.log(
    `\n${PROJECT_ID} wiped: ${only.join(", ")}. Security rules, indexes and ` +
      "deployed functions are untouched — this script only removes data.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
