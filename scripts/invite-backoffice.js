/**
 * Invites a back-office team member on the LIVE project, out of band: it writes
 * one invitation holding the hash of a one-time 6-character code valid 1 hour,
 * then emails the code. The ops equivalent of Paramètres → "Inviter un membre de
 * l'équipe Bike-eco", for when no admin can reach the app (nobody signed in, the
 * app is down, an invitation to re-send in a hurry).
 *
 * Options
 *   --email <email>   required — the invitee's address
 *   --isAdmin         the invitee lands an admin account; the default, like the
 *                     app's invitation, is a non-admin member
 *   --dry-run         prints the invitation document and the email it would
 *                     produce, and writes and sends nothing
 *   --show-code       also prints the code — the fallback when the email does
 *                     not arrive; transmit it only through a safe channel
 *
 * Run it from Cloud Shell — see docs/ops/first-backoffice-account.md. Firebase
 * credentials come from Application Default Credentials (your own Google login
 * there); the SMTP credentials are read from the same Secret Manager secrets the
 * deployed functions use (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS) through
 * the `gcloud` already installed there, and environment variables of those names
 * win over the secrets. Never commit or download a service-account key for this.
 *
 *   npm i firebase-admin nodemailer
 *   node invite-backoffice.js --email nouveau@bike-eco.fr
 *   node invite-backoffice.js --email nouveau@bike-eco.fr --isAdmin
 *   node invite-backoffice.js --email nouveau@bike-eco.fr --dry-run
 *
 * What it does
 *   · warns when the address already has an Auth account (the invited funnel
 *     creates one, so the code would fail on "Cette adresse email est déjà
 *     utilisée") or when a still-valid invitation exists for it
 *   · reads the SMTP secrets before writing anything, so a missing secret cannot
 *     leave behind an invitation with no email to carry its code
 *   · writes `invitations/{id}` — email, role "backoffice", companyId null,
 *     invitedBy "admin-script", isAdmin, the code's sha256, expiresAt +1h — and
 *     sends the invitation email
 *   · deletes that invitation again if the email fails to leave
 *   · re-running is how you re-send: each run mints a new code, and the codes
 *     already sent to that address stay valid until they expire
 *
 * What it does not do
 *   · creates no account: nothing exists until the invitee redeems the code in
 *     the app ("J'ai un code d'invitation"), where they pick their own password
 *     and their région gérée; an unredeemed invitation simply expires
 *   · does not revoke or replace earlier invitations
 *   · does not keep the code — only its hash is stored, so it is unrecoverable
 *     after the run; to hand it out again, run the script again
 *   · `invitedBy: "admin-script"` is not a uid, so these invitations are not
 *     among those delete-backoffice.js clears with an admin's account
 */
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { createHash, randomInt } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const nodemailer = require("nodemailer");

const PROJECT_ID = "bike-eco-43a84";
const DB_ID = "bike-eco-db";

// Mirrors functions/src/registration/inviteCode.ts. The picker is the CSPRNG,
// not Math.random: a code redeemed unauthenticated can mint a back-office
// identity, so it must be unpredictable.
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CODE_LENGTH = 6;
const INVITE_TTL_MS = 3_600_000; // 1 hour

/** The organisation name shown to a back-office invitee (BIKE_ECO_ORGANISATION). */
const ORGANISATION = "Bike-eco";

/** `invitedBy` for an invitation nobody sent from the app. Not a uid on purpose:
 *  it must never collide with one, and it reads as itself in the console. */
const INVITED_BY = "admin-script";

const SMTP_KEYS = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS"];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (!flag.startsWith("--")) continue;
    const eq = flag.indexOf("=");
    if (eq !== -1) {
      args[flag.slice(2, eq)] = flag.slice(eq + 1);
      continue;
    }
    const value = argv[i + 1];
    // A bare switch is `true`, and must not swallow the next flag as its value.
    // `--dry-run` alone therefore means dry run — the mistake worth guarding,
    // since the opposite reading sends a live back-office code. Same convention
    // as delete-backoffice.js; grant-backoffice.js records "" instead only
    // because its `--region` needs "omitted" and "given badly" to differ.
    args[flag.slice(2)] =
      value === undefined || value.startsWith("--") ? true : value;
  }
  if (typeof args.email !== "string" || !args.email.trim()) {
    console.error(
      "Missing --email\n\n" +
        "Usage: node invite-backoffice.js --email <email de l'invité> " +
        "[--isAdmin] [--dry-run] [--show-code]",
    );
    process.exit(1);
  }
  return args;
}

/** A boolean switch: `--flag`, `--flag true` and `--flag=true` all set it. */
function flag(args, name) {
  return args[name] === true || args[name] === "true";
}

function generateInviteCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

/** sha256 hex of the normalized code — the document stores this, never the code. */
function hashInviteCode(code) {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

/**
 * The SMTP secrets the deployed functions run on (functions/src/email.ts), read
 * from Secret Manager with `gcloud` — already installed and authenticated in
 * Cloud Shell, so this stays a two-dependency script. An environment variable
 * of the same name wins, which is also how `defineSecret().value()` resolves
 * inside the functions.
 *
 * The payload is used **verbatim**, un-trimmed, exactly as the functions get
 * it: a value that fails here is a value that fails in production too, and
 * silently repairing it would hide that.
 */
function readSecret(name) {
  if (process.env[name]) return process.env[name];
  try {
    return execFileSync(
      "gcloud",
      ["secrets", "versions", "access", "latest", `--secret=${name}`, `--project=${PROJECT_ID}`],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } catch {
    return null;
  }
}

function readSmtp() {
  const smtp = {};
  for (const key of SMTP_KEYS) smtp[key] = readSecret(key);
  const missing = SMTP_KEYS.filter((k) => !smtp[k]);
  if (missing.length) {
    throw new Error(
      `Secrets SMTP illisibles : ${missing.join(", ")}.\n` +
        "Le code ne serait écrit que dans Firestore, sans email pour le transmettre — rien n'a été fait.\n" +
        `Vérifiez l'accès : gcloud secrets versions access latest --secret=SMTP_HOST --project=${PROJECT_ID}\n` +
        "(ou passez-les en variables d'environnement SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS).",
    );
  }
  return smtp;
}

/** Same transport, same From and same body as `sendInviteEmail`. */
async function sendInviteEmail(smtp, to, code) {
  const port = Number(smtp.SMTP_PORT || "587");
  const transport = nodemailer.createTransport({
    host: smtp.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: smtp.SMTP_USER, pass: smtp.SMTP_PASS },
  });
  await transport.sendMail({
    from: `Bike-eco <${smtp.SMTP_USER}>`,
    to,
    subject: "Bike-eco — Vous êtes invité",
    text:
      `Bonjour,\n\nVous avez été invité à rejoindre ${ORGANISATION} sur Bike-eco. ` +
      `Ouvrez l'application, choisissez "J'ai un code d'invitation" et saisissez ce code :\n\n` +
      `    ${code}\n\nCe code est valable 1 heure.\n\nL'équipe Bike-eco`,
  });
  transport.close();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = flag(args, "dry-run");
  const showCode = flag(args, "show-code");
  const isAdmin = flag(args, "isAdmin");
  const email = args.email.trim();

  initializeApp({ projectId: PROJECT_ID });
  const auth = getAuth();
  const db = getFirestore(DB_ID);

  // Warnings, not refusals: `sendInvite` does not check either, and the app
  // would happily send the same invitation. They are what makes an invitation
  // that cannot be redeemed visible now rather than to the invitee.
  const existing = await auth.getUserByEmail(email).catch(() => null);
  if (existing) {
    console.warn(
      `\n⚠  ${email} a déjà un compte Auth (uid ${existing.uid}).\n` +
        "   Le parcours invité crée un compte : la saisie du code échouera sur\n" +
        '   "Cette adresse email est déjà utilisée". Supprimez le compte d\'abord\n' +
        "   (delete-backoffice.js / delete-b2b-user.js), ou réparez-le avec grant-backoffice.js.\n",
    );
  }
  const pending = await db.collection("invitations").where("email", "==", email).get();
  const live = pending.docs.filter((d) => d.data().expiresAt?.toMillis() > Date.now());
  if (live.length) {
    console.warn(
      `⚠  ${live.length} invitation(s) encore valide(s) pour ${email} — elles le restent.\n` +
        "   L'invité peut utiliser n'importe lequel des codes reçus.\n",
    );
  }

  // Read before writing: a missing secret must not leave an invitation behind
  // with no email to carry its code.
  const smtp = dryRun ? null : readSmtp();

  const code = generateInviteCode();
  const id = db.collection("invitations").doc().id;
  const expiresAt = Date.now() + INVITE_TTL_MS;

  if (dryRun) {
    console.log(
      `\n[dry-run] Rien n'a été écrit ni envoyé.\n` +
        `  invitations/${id} → { email: "${email}", role: "backoffice", companyId: null,\n` +
        `                        invitedBy: "${INVITED_BY}", isAdmin: ${isAdmin},\n` +
        `                        tokenHash: <sha256>,\n` +
        `                        expiresAt: ${new Date(expiresAt).toISOString()} }\n` +
        `  email → ${email} ("Bike-eco — Vous êtes invité", code à 6 caractères)\n\n` +
        "Relancez sans --dry-run pour envoyer.",
    );
    return;
  }

  // Shape must match Invitation in src/lib/firestore/schema.ts — `invitations`
  // is `allow read, write: if false` for clients, so nothing but the admin SDK
  // and the callables ever writes here.
  await db.collection("invitations").doc(id).set({
    email,
    role: "backoffice",
    companyId: null,
    invitedBy: INVITED_BY,
    isAdmin,
    tokenHash: hashInviteCode(code),
    expiresAt: Timestamp.fromMillis(expiresAt),
    createdAt: FieldValue.serverTimestamp(),
  });
  console.log(`Invitation invitations/${id} créée.`);

  try {
    await sendInviteEmail(smtp, email, code);
  } catch (e) {
    // The code lives only in this process — stored hashed, printed nowhere yet.
    // An invitation nobody can redeem is litter that stays readable for an hour,
    // so take it back rather than leave it to expire.
    const removed = await db.collection("invitations").doc(id).delete().then(
      () => true,
      () => false,
    );
    throw new Error(
      `L'email n'est pas parti : ${e instanceof Error ? e.message : e}\n` +
        (removed
          ? `L'invitation invitations/${id} a été supprimée — relancez le script.`
          : `⚠  L'invitation invitations/${id} n'a PAS pu être supprimée : elle reste\n` +
            "   valable une heure avec un code que plus personne ne connaît. Supprimez-la\n" +
            "   depuis la console Firestore."),
    );
  }

  console.log(
    `\nInvitation envoyée à ${email}.\n` +
      `Valable jusqu'à ${new Date(expiresAt).toLocaleString("fr-FR")} (1 heure).\n` +
      (showCode
        ? `Code : ${code} — à ne transmettre que par un canal sûr, il crée un compte\n` +
          `back-office${isAdmin ? " administrateur" : ""}.\n`
        : "Le code n'est affiché qu'avec --show-code (secours si l'email n'arrive pas) ;\n" +
          "il n'est stocké que haché, donc irrécupérable ensuite — relancez le script.\n") +
      "L'invité ouvre l'application → \"J'ai un code d'invitation\" et obtient un compte\n" +
      (isAdmin
        ? "back-office actif et administrateur.\n"
        : "back-office actif et non administrateur, à promouvoir depuis « Mes collaborateurs »\n" +
          "(ou relancez avec --isAdmin).\n"),
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
