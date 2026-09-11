/**
 * Copies documents from a **recovered** database (the temporary one created by
 * `firestore:databases:clone` or `:restore`) back into the LIVE `bike-eco-db`.
 * The manual step of docs/ops/recover-firestore.md, turned into a script: pick a
 * collection — `users`, `dossiers`, or a subcollection path — and it walks it,
 * subcollections included, and writes what is missing.
 *
 * Neither `clone` nor `restore` rewrites the live database: both create a new
 * one beside it. This is what bridges the gap.
 *
 * Options
 *   --from <db-id>      source database, e.g. `recovery-20260914` (required)
 *   --collection <path> what to restore (required): a top-level collection
 *                       (`users`, `companies`, `invitations`, `dossiers`) or a
 *                       subcollection path (`dossiers/<id>/messages`). Always an
 *                       odd number of segments — it names a collection, not a
 *                       document
 *   --ids <list>        comma-separated document ids, to restore only those;
 *                       default: every document of the collection
 *   --to <db-id>        target database; defaults to `bike-eco-db`, the live one
 *   --overwrite         replace documents that still exist in the target. OFF by
 *                       default: a document present in both was most likely
 *                       written legitimately since the incident, and the old
 *                       copy would undo that work
 *   --no-subcollections stop at the documents named; by default each one carries
 *                       its subcollections (`messages`, `mutes`, `pushTokens`),
 *                       which do **not** follow their parent otherwise
 *   --yes               apply; without it the run is a dry run that prints the
 *                       plan and writes nothing
 *
 * Run it from Cloud Shell — see docs/ops/recover-firestore.md. Credentials come
 * from Application Default Credentials (your own Google login there); never
 * commit or download a service-account key for this.
 *
 *   npm i firebase-admin
 *   node recover-documents.js --from recovery-20260914 --collection users
 *   node recover-documents.js --from recovery-20260914 --collection users --yes
 *
 * What it does
 *   1. reads the collection in the source database, applying --ids
 *   2. lists the ids already present in the target, to know what to skip
 *   3. writes the missing documents in batches, then recurses into each
 *      document's subcollections and repeats
 *
 *   Writes are additive: nothing is ever deleted from the target, and a document
 *   that exists on both sides is left alone unless --overwrite says otherwise.
 *   The run is re-runnable — interrupted halfway, running it again picks up the
 *   rest.
 *
 * What it does not do
 *   · does not restore Cloud Storage files: a recovered `dossiers` document
 *     brings back its `photoUrls`, but those URLs point at nothing if the photos
 *     were deleted (Storage has its own 7-day soft delete)
 *   · does not restore Auth users: a document referring to a deleted uid comes
 *     back pointing at an account that no longer exists. Recreating that account
 *     gives it a **new** uid, which will not match the restored `submittedBy`,
 *     `invitedBy` or `ownerUid`
 *   · does not reconcile: it never removes or merges fields on a document it
 *     skips, and never deletes anything created since the incident
 *   · does not touch the security rules, the indexes or the deployed functions
 */
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const PROJECT_ID = "bike-eco-43a84";
const LIVE_DB_ID = "bike-eco-db";

/** Firestore caps a write batch at 500 operations. */
const BATCH_SIZE = 400;

const USAGE =
  "Usage: node recover-documents.js --from <db-id> --collection <path>\n" +
  "         [--ids a,b,c] [--to <db-id>] [--overwrite] [--no-subcollections] [--yes]";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const next = argv[i + 1];
    // Bare switches take no value; `--yes --from x` must not swallow "--from".
    args[flag.slice(2)] = next && !next.startsWith("--") ? next : true;
  }

  const from = typeof args.from === "string" ? args.from.trim() : "";
  const to = typeof args.to === "string" ? args.to.trim() : LIVE_DB_ID;
  const path = typeof args.collection === "string" ? args.collection.trim() : "";

  if (!from || !path) {
    console.error(`Missing --from and/or --collection\n\n${USAGE}`);
    process.exit(1);
  }

  // Recovering *from* the live database would be a no-op at best, and with
  // --overwrite a way to rewrite documents with themselves.
  if (from === to) {
    console.error(
      `--from and --to are the same database ("${from}"). The source is the ` +
        "temporary database created by `firestore:databases:clone` or " +
        `\`:restore\`, never ${LIVE_DB_ID} itself.\n\n${USAGE}`,
    );
    process.exit(1);
  }

  // A collection path has an odd number of segments; an even one names a
  // document, and `db.collection()` would throw further down with no context.
  const segments = path.split("/").filter(Boolean);
  if (segments.length % 2 === 0 || segments.join("/") !== path) {
    console.error(
      `--collection "${path}" is not a collection path. Expected an odd number ` +
        "of segments, e.g. `users` or `dossiers/<dossierId>/messages`.\n\n" +
        USAGE,
    );
    process.exit(1);
  }

  const ids =
    args.ids === true || args.ids === undefined
      ? null
      : String(args.ids)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
  if (ids && !ids.length) {
    console.error(`--ids was given but lists no id\n\n${USAGE}`);
    process.exit(1);
  }

  return {
    from,
    to,
    path,
    ids,
    apply: args.yes === true,
    overwrite: args.overwrite === true,
    subcollections: args["no-subcollections"] !== true,
  };
}

/**
 * Rewrites any DocumentReference onto the target database. A reference read
 * from the source points at the source database, and the SDK refuses to write
 * it ("Firestore instance mismatch"). The current model stores ids as strings,
 * so this is a guard for a field added later rather than a path in use today.
 */
function remapRefs(value, target) {
  if (value === null || typeof value !== "object") return value;
  if (typeof value.firestore === "object" && typeof value.path === "string") {
    return target.doc(value.path);
  }
  // Timestamp, GeoPoint, Buffer: opaque values, copied as they are.
  if (typeof value.toDate === "function" || Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map((v) => remapRefs(v, target));
  if (Object.getPrototypeOf(value) !== Object.prototype) return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, remapRefs(v, target)]),
  );
}

/** Ids already present in the target, read without paying for the documents. */
async function existingIds(colRef) {
  const snap = await colRef.select().get();
  return new Set(snap.docs.map((d) => d.id));
}

/**
 * Copies one collection, then each copied document's subcollections. Returns
 * the running totals; `plan` lines feed the dry-run output.
 */
async function copyCollection(source, target, path, options, totals, depth = 0) {
  const sourceCol = source.collection(path);
  const targetCol = target.collection(path);

  const snap = options.ids
    ? await sourceCol.firestore.getAll(...options.ids.map((id) => sourceCol.doc(id)))
    : (await sourceCol.get()).docs;
  const docs = snap.filter((d) => d.exists);

  const present = options.overwrite ? new Set() : await existingIds(targetCol);
  const toWrite = docs.filter((d) => !present.has(d.id));
  const skipped = docs.length - toWrite.length;

  totals.found += docs.length;
  totals.written += toWrite.length;
  totals.skipped += skipped;

  const label = `${"  ".repeat(depth)}· ${path}`;
  console.log(
    `  ${label.padEnd(46)} ${docs.length} found, ${toWrite.length} to write` +
      (skipped ? `, ${skipped} already in ${options.to}` : ""),
  );

  // Reported under the collection line, not before it: an id the incident was
  // about being absent from the recovered copy is the one result worth a second
  // look — the snapshot is older than the document, or the id is a typo.
  for (const id of options.ids ?? []) {
    if (!docs.some((d) => d.id === id)) {
      console.log(`      ${id} — absent from the source`);
      totals.missing += 1;
    }
  }

  if (options.apply) {
    for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
      const batch = target.batch();
      for (const doc of toWrite.slice(i, i + BATCH_SIZE)) {
        batch.set(targetCol.doc(doc.id), remapRefs(doc.data(), target));
      }
      await batch.commit();
    }
  }

  if (!options.subcollections) return;

  // Subcollections hang off the source document whether or not the parent was
  // written: a document skipped as "already live" can still be missing its
  // messages. Walked for every document found, not just the ones copied.
  for (const doc of docs) {
    for (const sub of await doc.ref.listCollections()) {
      await copyCollection(
        source,
        target,
        `${path}/${doc.id}/${sub.id}`,
        // Only the top-level collection is filtered by --ids.
        { ...options, ids: null },
        totals,
        depth + 1,
      );
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  initializeApp({ projectId: PROJECT_ID });
  const source = getFirestore(options.from);
  const target = getFirestore(options.to);

  const emulated = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  console.log(`\n${emulated ? "EMULATORS" : "LIVE PROJECT"}: ${PROJECT_ID}`);
  console.log(`  from         ${options.from} (recovered copy, read-only here)`);
  console.log(`  to           ${options.to}${options.to === LIVE_DB_ID ? " — the live database" : ""}`);
  console.log(`  collection   ${options.path}`);
  console.log(`  documents    ${options.ids ? options.ids.join(", ") : "all"}`);
  console.log(`  existing     ${options.overwrite ? "OVERWRITTEN" : "left untouched"}`);
  console.log(`  subcollections ${options.subcollections ? "included" : "skipped"}`);
  console.log("");

  const totals = { found: 0, written: 0, skipped: 0, missing: 0 };
  await copyCollection(source, target, options.path, options, totals);

  if (!totals.found) {
    console.error(
      `\nNothing found in ${options.from} at "${options.path}". Check the ` +
        "database id and the collection name — a clone that is still running " +
        "reads as empty (`firestore:operations:describe`).",
    );
    process.exit(1);
  }

  console.log(
    `\n${totals.found} document(s) in the source, ${totals.written} ` +
      `${options.apply ? "written" : "to write"}, ${totals.skipped} skipped` +
      (totals.missing ? `, ${totals.missing} requested id(s) absent` : "") + ".",
  );

  if (!options.apply) {
    console.log(
      "\nDry run — nothing written. To apply:\n  node recover-documents.js " +
        `${process.argv.slice(2).join(" ")} --yes`,
    );
    return;
  }

  if (options.overwrite) {
    console.log(
      "\nDocuments present on both sides were replaced by the recovered copy: " +
        "anything written to them since the incident is gone.",
    );
  }
  console.log(
    `\nDone. Storage files and Auth users are NOT restored by this script — ` +
      "check `photoUrls` and the uids the restored documents point at " +
      "(docs/ops/recover-firestore.md). Remember to delete " +
      `${options.from} once the recovery is verified: it is billed as a normal database.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
