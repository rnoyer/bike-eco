/**
 * Creates (or repairs) a b2b (vendeur) account on the LIVE project.
 *
 * The product path for this is `registerCompany` / `acceptInvite`, which always
 * mint a `pending` account waiting on back-office validation. This script is the
 * out-of-band equivalent: same three server-side writes as a real registration —
 * the Auth user, the custom claims (source of truth for access, see
 * src/lib/auth/session.ts + firestore.rules), and the `users/{uid}` profile doc
 * in the named `bike-eco-db` database — but it can attach to an existing company
 * and can hand out an `active` account directly.
 *
 * Self-contained on purpose: single file, one dependency, no repo checkout
 * needed. Run it from Cloud Shell — see docs/ops/manage-accounts.md.
 * Idempotent: re-running repairs whatever drifted.
 *
 *   npm i firebase-admin
 *
 *   # attach to an existing company (its id, from the back-office URL or console)
 *   node create-b2b.js --email a@b.fr --prenom Alex --nom Martin --tel 0605060708 \
 *     --company aBcD1234
 *
 *   # or find/create the company by SIRET
 *   node create-b2b.js --email a@b.fr --prenom Alex --nom Martin --tel 0605060708 \
 *     --siret 12345678900011 --societe "Garage du Nord" \
 *     --departement "75 - Paris" --ville Paris
 *
 * `--status pending` reproduces the real registration gate (account created but
 * blocked until a back-office validation); the default is `active`.
 *
 * The account is an admin when this run creates the company (same rule as the
 * registration funnel), or when `--admin true` is passed to admin-ify an
 * account joining an existing company.
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

const USAGE =
  "Usage: node create-b2b.js --email <email> --prenom <prénom> --nom <nom> " +
  "--tel <téléphone>\n" +
  "         (--company <companyId> | --siret <14 chiffres>)\n" +
  '         [--societe <raison sociale> --departement "75 - Paris" --ville <ville>]\n' +
  "         [--status active|pending] [--password <mot de passe>] [--admin true]";

// Mirrors functions/src/regions.ts — duplicated so the script stays pasteable.
// Keep in sync when the département → centre mapping changes.
const NORTH_CODES = new Set([
  "02",
  "03",
  "08",
  "10",
  "14",
  "18",
  "21",
  "22",
  "27",
  "28",
  "29",
  "33",
  "35",
  "36",
  "37",
  "39",
  "41",
  "44",
  "45",
  "49",
  "50",
  "51",
  "52",
  "53",
  "54",
  "55",
  "56",
  "57",
  "58",
  "59",
  "60",
  "61",
  "62",
  "67",
  "68",
  "70",
  "71",
  "72",
  "75",
  "76",
  "77",
  "78",
  "80",
  "85",
  "88",
  "89",
  "90",
  "91",
  "92",
  "93",
  "94",
  "95",
]);
const SOUTH_CODES = new Set([
  "01",
  "04",
  "05",
  "06",
  "07",
  "09",
  "11",
  "12",
  "13",
  "15",
  "16",
  "17",
  "19",
  "23",
  "24",
  "25",
  "26",
  "30",
  "31",
  "32",
  "34",
  "38",
  "40",
  "42",
  "43",
  "46",
  "47",
  "48",
  "63",
  "64",
  "65",
  "66",
  "69",
  "73",
  "74",
  "79",
  "81",
  "82",
  "83",
  "84",
  "86",
  "87",
  "2A",
  "2B",
]);

/** Unknown / empty falls back to NORTH so a dossier is never left unrouted. */
function resolveRegion(departement) {
  const code = (departement || "").split(" - ")[0].trim();
  if (SOUTH_CODES.has(code)) return "SOUTH";
  if (NORTH_CODES.has(code)) return "NORTH";
  return "NORTH";
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    args[flag.slice(2)] = argv[i + 1];
  }
  const problems = REQUIRED.filter((k) => !args[k]).map(
    (k) => `Missing --${k}`,
  );
  if (!args.company && !args.siret) {
    problems.push("Missing --company <companyId> or --siret <14 chiffres>");
  }
  if (args.siret && !/^\d{14}$/.test(args.siret)) {
    problems.push("--siret must be exactly 14 digits");
  }
  args.status = args.status || "active";
  if (!["active", "pending"].includes(args.status)) {
    problems.push("--status must be active or pending");
  }
  if (problems.length) {
    console.error(`${problems.join("\n")}\n\n${USAGE}`);
    process.exit(1);
  }
  return args;
}

/**
 * Resolve the company this account belongs to, creating it when --siret points
 * at no existing company. A b2b account without a real company is useless: the
 * dashboard reads `dossiers where companyId == claims.companyId`, so a dangling
 * id yields a permanently empty, unexplained screen.
 */
async function resolveCompany(db, args, uid) {
  if (args.company) {
    const snap = await db.collection("companies").doc(args.company).get();
    if (!snap.exists) {
      console.error(
        `No company ${args.company} in "${DB_ID}". Check the id, or pass --siret ` +
          "with --societe/--departement/--ville to create one.",
      );
      process.exit(1);
    }
    console.log(`Using company ${snap.id} (${snap.data().name}).`);
    return { id: snap.id, created: false }; // existing company by --company
  }

  const found = await db
    .collection("companies")
    .where("siret", "==", args.siret)
    .limit(1)
    .get();
  if (!found.empty) {
    const doc = found.docs[0];
    console.log(
      `SIRET ${args.siret} already registered — reusing ${doc.id} (${doc.data().name}).`,
    );
    return { id: doc.id, created: false }; // existing company found by SIRET
  }

  const missing = ["societe", "departement", "ville"].filter((k) => !args[k]);
  if (missing.length) {
    console.error(
      `No company for SIRET ${args.siret}. To create it, add --${missing.join(", --")}.\n\n${USAGE}`,
    );
    process.exit(1);
  }

  const id = db.collection("companies").doc().id;
  // Shape must match Company in src/lib/firestore/schema.ts. `region` is derived
  // from the département exactly as registerCompanyCore does — it drives which
  // back-office centre sees the company's dossiers.
  await db
    .collection("companies")
    .doc(id)
    .set({
      siret: args.siret,
      name: args.societe,
      status: args.status,
      departement: args.departement,
      ville: args.ville,
      region: resolveRegion(args.departement),
      createdBy: uid,
      createdByName: `${args.prenom} ${args.nom}`,
      validatedAt:
        args.status === "active" ? FieldValue.serverTimestamp() : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  console.log(
    `Created company ${id} (${args.societe}, ${resolveRegion(args.departement)}, ${args.status}).`,
  );
  return { id, created: true }; // company created by this run
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
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

  const { id: companyId, created } = await resolveCompany(db, args, user.uid);
  // The company's creator is its admin — same rule as the registration funnel.
  const isAdmin = created || args.admin === "true";

  // Claims are set as one object: setCustomUserClaims replaces the whole bag,
  // so every field the app reads has to be present on each call.
  await auth.setCustomUserClaims(user.uid, {
    role: "b2b",
    companyId,
    status: args.status,
  });

  // Console/Admin writes bypass security rules — `users` is `allow create: if
  // false` for clients. Shape must match AppUser in src/lib/firestore/schema.ts;
  // the client converter is a pass-through, so a wrong field name would only
  // surface as missing data at read time.
  const ref = db.collection("users").doc(user.uid);
  const exists = (await ref.get()).exists;
  await ref.set(
    {
      role: "b2b",
      companyId,
      isAdmin,
      nom: args.nom,
      prenom: args.prenom,
      email: args.email,
      telephone: args.tel,
      status: args.status,
      ...(exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log(
    `\nB2B account ready: ${args.email} (uid ${user.uid}, company ${companyId}, ` +
      `status ${args.status}).\n` +
      "Next: send a password-reset email from the Firebase console, then sign in.",
  );
  if (args.status === "pending") {
    console.log(
      "Status is `pending`: sign-in lands on the waiting screen until the " +
        "back-office validates the company (Réglages → Gérer les entreprises).",
    );
  }
  console.log(
    "If the account was already signed in somewhere, claims only refresh on a " +
      "new ID token — sign out and back in.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
