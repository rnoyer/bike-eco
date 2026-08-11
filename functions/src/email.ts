import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";

import { section, shell, type Row } from "./emailHtml";
import type { B2cPayload } from "./payload";
import { resolveRegion } from "./regions";

// ─── secrets / config ────────────────────────────────────────────────────────

// Only the bundle below is imported elsewhere; the individual secrets are
// read through `.value()` inside this module.
const SMTP_HOST = defineSecret("SMTP_HOST");
const SMTP_PORT = defineSecret("SMTP_PORT");
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");

export const B2C_EMAIL_SECRETS = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS];

/**
 * During the development phase every email is routed here regardless of region
 * (per the product spec). Swap these for the real mailboxes and flip
 * DEV_EMAIL_OVERRIDE off when going live.
 */
const DEV_EMAIL_OVERRIDE = false;
const DEV_EMAIL = "romain.noyer@gmail.com";
const NORTH_MAILBOX = "romain.noyer@gmail.com"; // TODO: real NORTH mailbox
const SOUTH_MAILBOX = "romain.noyer@gmail.com"; // TODO: real SOUTH mailbox

/**
 * Sender address. Most SMTP providers (Gmail included) require the From to be
 * the authenticated account, so default to SMTP_USER when configured and fall
 * back to a placeholder only for the dev/JSON transport.
 */
function fromAddress(): string {
  if (smtpConfigured()) return `Bike-eco <${SMTP_USER.value()}>`;
  return "Bike-eco <noreply@bike-eco.fr>";
}

function teamRecipient(departement: string): string {
  if (DEV_EMAIL_OVERRIDE) return DEV_EMAIL;
  return resolveRegion(departement) === "SOUTH" ? SOUTH_MAILBOX : NORTH_MAILBOX;
}

function customerRecipient(email: string): string {
  return DEV_EMAIL_OVERRIDE ? DEV_EMAIL : email;
}

// ─── transport (pooled, module-scope, reused across invocations) ─────────────

let cachedTransport: nodemailer.Transporter | null = null;

/**
 * Build the SMTP transport once and reuse it. When SMTP secrets are absent
 * (e.g. the local emulator), fall back to a JSON transport that logs the
 * composed message instead of sending — so the full flow is testable offline.
 */
function getTransport(): { transport: nodemailer.Transporter; dev: boolean } {
  if (cachedTransport) {
    return { transport: cachedTransport, dev: !smtpConfigured() };
  }
  if (smtpConfigured()) {
    cachedTransport = nodemailer.createTransport({
      host: SMTP_HOST.value(),
      port: Number(SMTP_PORT.value() || "587"),
      secure: Number(SMTP_PORT.value() || "587") === 465,
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
      pool: true,
      maxConnections: 5,
    });
    return { transport: cachedTransport, dev: false };
  }
  logger.warn("SMTP secrets not set — using JSON transport (emails are logged, not sent).");
  cachedTransport = nodemailer.createTransport({ jsonTransport: true });
  return { transport: cachedTransport, dev: true };
}

function smtpConfigured(): boolean {
  try {
    return Boolean(SMTP_HOST.value());
  } catch {
    return false;
  }
}

/** Reusable single-email sender for non-B2C flows (registration). Same transport + secrets. */
export async function sendMail(opts: { to: string; subject: string; text: string }): Promise<void> {
  const { transport } = getTransport();
  await transport.sendMail({
    from: fromAddress(),
    to: DEV_EMAIL_OVERRIDE ? DEV_EMAIL : opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}

/** Reusable HTML sender for non-B2C flows (the back-office dossier recap).
 *  Same pooled transport, same From, same dev override as `sendMail`. */
export async function sendHtmlMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const { transport } = getTransport();
  await transport.sendMail({
    from: fromAddress(),
    to: DEV_EMAIL_OVERRIDE ? DEV_EMAIL : opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

export interface Attachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

async function send(
  to: string,
  subject: string,
  html: string,
  attachments: Attachment[] = []
): Promise<void> {
  const { transport, dev } = getTransport();
  const info = await transport.sendMail({
    from: fromAddress(),
    to,
    subject,
    html,
    attachments,
  });
  if (dev) {
    logger.info("Email (dev/JSON transport)", {
      to,
      subject,
      attachments: attachments.map((a) => a.filename),
      message: info.message?.toString(),
    });
  }
}

const yesNo = (v: string | null) => (v === "oui" ? "Oui" : v === "non" ? "Non" : v ?? "");

// ─── sections shared by both emails ──────────────────────────────────────────
//
// The two emails present the same submission to different audiences: they order
// their sections differently and address the reader differently, but the État /
// Demande / Clés / Papiers blocks are the same questions with the same labels.
// Defining each once is what stops a new form field reaching one email only.

/** "Marque Modèle", or the caller's fallback when the vehicle is unnamed. */
function vehicleLabel(f: B2cPayload, fallback: string): string {
  return [f.marque, f.modele].filter(Boolean).join(" ") || fallback;
}

/** The team email's subject, also used as its heading. */
function teamSubject(f: B2cPayload): string {
  return `Nouvelle demande de rachat — ${f.departement} — ${vehicleLabel(f, "Véhicule")}`;
}

const etatSection = (f: B2cPayload) =>
  section("État", [
    ["État", f.etat],
    ["Nature de la panne", f.naturePanne],
  ]);

/** `photoCount` is the team-only "Photos jointes" row — the customer's copy of
 *  this section omits it, since they know what they just uploaded. */
const demandeSection = (f: B2cPayload, photoCount?: number) =>
  section("Demande", [
    ["Prix souhaité", f.prix && `${f.prix} €`],
    ["Commentaires", f.commentaires],
    ["Reprise", f.modalite],
    ...(photoCount === undefined
      ? []
      : ([["Photos jointes", String(photoCount)]] as Row[])),
  ]);

const clesSection = (f: B2cPayload) =>
  section("Clés et télécommandes", [
    ["Clés de contact", yesNo(f.aClesContact)],
    ["Clé noire", f.cleNoire],
    ["Clé marron", f.cleMarron],
    ["Clé rouge", f.cleRouge],
    ["Télécommande / Bip", yesNo(f.aTelecommande)],
    ["Nb télécommandes", f.telecommande],
  ]);

const papiersSection = (f: B2cPayload) =>
  section("Papiers", [
    ["Carte grise", yesNo(f.carteGrise)],
    ["Carte grise à son nom", yesNo(f.carteGriseAVotreNom)],
    ["Contrôle technique", yesNo(f.controleTechnique)],
    ["CT < 6 mois", yesNo(f.ctMoins6Mois)],
    ["Résultat CT", f.resultatCT],
    ["Certificat de non-gage", yesNo(f.certificatNonGage)],
    ["Carnet d'entretien", yesNo(f.carnetEntretien)],
    ["Facture d'entretien", yesNo(f.factureEntretien)],
  ]);

/** Shared tail of the vehicle block. The head differs: the customer sees one
 *  "Véhicule" line, the team sees Marque and Modèle apart for scanning. */
const vehicleTailRows = (f: B2cPayload): Row[] => [
  ["Cylindrée", f.cylindree && `${f.cylindree} cc`],
  ["Année", f.annee],
  ["Kilométrage", f.kilometrage && `${f.kilometrage} km`],
  ["Accessoires", f.accessoires],
];

// ─── customer recap email ────────────────────────────────────────────────────

function customerHtml(f: B2cPayload): string {
  const body =
    section("Votre véhicule", [
      ["Véhicule", vehicleLabel(f, "Votre véhicule")],
      ["Électrique", yesNo(f.electrique)],
      ["Matériel", f.materiel.join(", ")],
      ...vehicleTailRows(f),
    ]) +
    etatSection(f) +
    demandeSection(f) +
    clesSection(f) +
    papiersSection(f) +
    section("Vos coordonnées", [
      ["Nom", `${f.prenom} ${f.nom}`],
      ["Email", f.email],
      ["Téléphone", f.telephone],
      ["Ville", `${f.ville} (${f.departement})`],
    ]);
  return shell(
    "Demande bien reçue !",
    "Voici le récapitulatif complet de votre demande. Notre équipe vous recontactera très prochainement.",
    body
  );
}

// ─── team notification email (all fields + attachments) ──────────────────────

function teamHtml(f: B2cPayload, photoCount: number): string {
  const body =
    etatSection(f) +
    demandeSection(f, photoCount) +
    section("Véhicule", [
      ["Électrique", yesNo(f.electrique)],
      ["Matériel", f.materiel.join(", ")],
      ["Marque", f.marque],
      ["Modèle", f.modele],
      ...vehicleTailRows(f),
    ]) +
    clesSection(f) +
    papiersSection(f) +
    section("Coordonnées", [
      ["Nom", `${f.prenom} ${f.nom}`],
      ["Email", f.email],
      ["Téléphone", f.telephone],
      ["Département", f.departement],
      ["Ville", f.ville],
    ]);
  return shell(
    teamSubject(f),
    `${f.prenom} ${f.nom} • ${f.departement} • ${f.telephone}`,
    body
  );
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Send the two B2C emails. The team email (with photo attachments) is sent
 * first because it is the operationally critical one.
 */
export async function sendB2cEmails(
  payload: B2cPayload,
  attachments: Attachment[]
): Promise<void> {
  await send(
    teamRecipient(payload.departement),
    teamSubject(payload),
    teamHtml(payload, attachments.length),
    attachments
  );

  await send(
    customerRecipient(payload.email),
    "Bike-eco — votre demande a bien été reçue",
    customerHtml(payload)
  );
}
