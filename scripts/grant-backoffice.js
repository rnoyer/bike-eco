/**
 * Creates (or repairs) the FIRST back-office account on the LIVE project.
 *
 * `sendInvite` can mint a `backoffice` identity too, but only an active admin
 * caller may invoke it — so nothing in the app can mint the very first one.
 * This script is that bootstrap. Every back-office account after it is
 * invited from the app by an existing admin (Paramètres → "Inviter un membre
 * de l'équipe Bike-eco"); re-run this script only to repair drift on an
 * existing account, not to add more. It performs the three server-side
 * writes a working session needs: the Auth user, the custom claims (source
 * of truth for access, see src/lib/auth/session.ts + firestore.rules), and
 * the `users/{uid}` profile doc in the named `bike-eco-db` database (without
 * it AuthProvider leaves the session null and the guard bounces the user
 * back to sign-in).
 *
 * Self-contained on purpose: single file, one dependency, no repo checkout
 * needed. Run it from Cloud Shell — see docs/ops/first-backoffice-account.md.
 * Idempotent: re-running repairs whatever drifted.
 *
 *   npm i firebase-admin
 *   node grant-backoffice.js --email a@b.fr --prenom Alex --nom Martin --tel 0605060708
 *
 * Credentials come from Application Default Credentials (your own Google login
 * in Cloud Shell). Never commit or download a service-account key for this.
 */
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { randomBytes } = require("node:crypto");

const PROJECT_ID = "bike-eco-43a84";
const DB_ID = "bike-eco-db";
const REQUIRED = ["email", "prenom", "nom", "tel"];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    // Both spellings, and a flag left without a value records "" rather than
    // `undefined` — that difference is what lets `readRegion` tell "not asked
    // for" (leave the field alone) apart from "asked for, badly" (refuse).
    const eq = flag.indexOf("=");
    if (eq !== -1) {
      args[flag.slice(2, eq)] = flag.slice(eq + 1);
      continue;
    }
    const value = argv[i + 1];
    args[flag.slice(2)] =
      value === undefined || value.startsWith("--") ? "" : value;
  }
  const missing = REQUIRED.filter((k) => !args[k]);
  if (missing.length) {
    console.error(
      `Missing --${missing.join(", --")}\n\n` +
        "Usage: node grant-backoffice.js --email <email> --prenom <prénom> " +
        "--nom <nom> --tel <téléphone> [--password <mot de passe>] [--no-admin true] " +
        "[--region north|south|all]",
    );
    process.exit(1);
  }
  return args;
}

// Back-office accounts are admins by default: they are the founding team, and
// an admin is the only account that can manage (or delete) team members.
// `--no-admin true` creates a plain member.
function readIsAdmin(args) {
  return args["no-admin"] !== "true";
}

// `--region` sets the "région gérée" (users/{uid}.notificationRegion): it filters
// the back-office dashboard AND scopes push fan-out, so a wrong value would page
// the holder about the other half of the country. `all` is the explicit null
// ("Toute la France"), which is also what the app assumes when the field is absent.
const REGIONS = { north: "NORTH", south: "SOUTH", all: null };

/** `undefined` = flag omitted → leave the field alone. The write below is a
 *  merge, so a repair run without `--region` must not wipe a choice the holder
 *  has since made in Paramètres → "Région gérée". */
function readRegion(args) {
  if (args.region === undefined) return undefined;
  const key = args.region.toLowerCase();
  if (!(key in REGIONS)) {
    console.error(
      `Invalid --region "${args.region}". Expected one of: north, south, all.`,
    );
    process.exit(1);
  }
  return REGIONS[key];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isAdmin = readIsAdmin(args);
  const region = readRegion(args);
  // Generated when not supplied: the holder sets their real password from the
  // reset email, so nobody else ever knows it.
  const password = args.password || randomBytes(24).toString("base64url");

  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore(DB_ID);

  let user = await auth.getUserByEmail(args.email).catch(() => null);
  if (user) {
    if (args.password) await auth.updateUser(user.uid, { password });
    console.log(`Existing Auth user ${user.uid} — reusing it.`);
  } else {
    user = await auth.createUser({ email: args.email, password });
    console.log(`Created Auth user ${user.uid}.`);
    if (!args.password) console.log(`Temporary password: ${password}`);
  }

  // Mirrors the `user_bo` identity in scripts/seed.ts. Claims are set as one
  // object: setCustomUserClaims replaces the whole bag.
  await auth.setCustomUserClaims(user.uid, {
    role: "backoffice",
    companyId: null,
    status: "active",
  });

  // Console/Admin writes bypass security rules — `users` is `allow create: if
  // false` for clients. Shape must match AppUser in src/lib/firestore/schema.ts;
  // the client converter is a pass-through, so a wrong field name would only
  // surface as missing data at read time.
  const ref = db.collection("users").doc(user.uid);
  const exists = (await ref.get()).exists;
  await ref.set(
    {
      role: "backoffice",
      companyId: null,
      isAdmin,
      nom: args.nom,
      prenom: args.prenom,
      email: args.email,
      telephone: args.tel,
      status: "active",
      ...(region === undefined ? {} : { notificationRegion: region }),
      ...(exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(
    `\nBack-office account ready: ${args.email} (uid ${user.uid}).\n` +
      "Next: send a password-reset email from the Firebase console, then sign " +
      "in — you should land on the back-office dashboard.\n" +
      `Admin: ${isAdmin}.\n` +
      `Région gérée: ${
        region === undefined
          ? "unchanged (defaults to Toute la France when never set)"
          : (region ?? "Toute la France")
      }.\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
