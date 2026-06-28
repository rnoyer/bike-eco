import * as logger from "firebase-functions/logger";
import { defineSecret } from "firebase-functions/params";
import * as nodemailer from "nodemailer";

import type { B2cPayload } from "./payload";
import { resolveRegion } from "./regions";

// ─── secrets / config ────────────────────────────────────────────────────────

export const SMTP_HOST = defineSecret("SMTP_HOST");
export const SMTP_PORT = defineSecret("SMTP_PORT");
export const SMTP_USER = defineSecret("SMTP_USER");
export const SMTP_PASS = defineSecret("SMTP_PASS");

export const B2C_EMAIL_SECRETS = [SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS];

/**
 * During the development phase every email is routed here regardless of region
 * (per the product spec). Swap these for the real mailboxes and flip
 * DEV_EMAIL_OVERRIDE off when going live.
 */
const DEV_EMAIL_OVERRIDE = true;
const DEV_EMAIL = "romain.noyer@gmail.com";
const NORTH_MAILBOX = "nord@bike-eco.example"; // TODO: real NORTH mailbox
const SOUTH_MAILBOX = "sud@bike-eco.example"; // TODO: real SOUTH mailbox

/**
 * Sender address. Most SMTP providers (Gmail included) require the From to be
 * the authenticated account, so default to SMTP_USER when configured and fall
 * back to a placeholder only for the dev/JSON transport.
 */
function fromAddress(): string {
  if (smtpConfigured()) return `Bike-eco <${SMTP_USER.value()}>`;
  return "Bike-eco <no-reply@bike-eco.example>";
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

// ─── HTML rendering helpers ──────────────────────────────────────────────────

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A label/value row, dropped entirely when the value is empty/null. */
type Row = [label: string, value: string | null | undefined];

function rowsHtml(rows: Row[]): string {
  const visible = rows.filter(([, v]) => v != null && String(v).trim() !== "");
  return visible
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:4px 12px 4px 0;color:#71727A;font-size:13px;vertical-align:top;">${esc(label)}</td>` +
        `<td style="padding:4px 0;color:#111;font-size:13px;font-weight:600;">${esc(String(value))}</td>` +
        `</tr>`
    )
    .join("");
}

function section(title: string, rows: Row[]): string {
  const body = rowsHtml(rows);
  if (!body) return "";
  return (
    `<h2 style="font-size:15px;color:#111;margin:20px 0 6px;">${esc(title)}</h2>` +
    `<table style="border-collapse:collapse;width:100%;">${body}</table>`
  );
}

function shell(title: string, intro: string, body: string): string {
  return (
    `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;">` +
    `<h1 style="font-size:22px;color:#111;margin:0 0 8px;">${esc(title)}</h1>` +
    `<p style="font-size:14px;color:#71727A;margin:0 0 8px;">${esc(intro)}</p>` +
    body +
    `</div>`
  );
}

const yesNo = (v: string | null) => (v === "oui" ? "Oui" : v === "non" ? "Non" : v ?? "");

// ─── customer recap email ────────────────────────────────────────────────────

function customerHtml(f: B2cPayload): string {
  const vehicule = [f.marque, f.modele].filter(Boolean).join(" ") || "Votre véhicule";
  const body =
    section("Vos coordonnées", [
      ["Nom", `${f.prenom} ${f.nom}`],
      ["Email", f.email],
      ["Téléphone", f.telephone],
      ["Ville", `${f.ville} (${f.departement})`],
    ]) +
    section("Votre véhicule", [
      ["Véhicule", vehicule],
      ["Cylindrée", f.cylindree && `${f.cylindree} cc`],
      ["Année", f.annee],
      ["Kilométrage", f.kilometrage && `${f.kilometrage} km`],
      ["État", f.etat],
    ]) +
    section("Votre demande", [
      ["Prix souhaité", f.prix && `${f.prix} €`],
      ["Reprise", f.modalite],
      ["Commentaires", f.commentaires],
    ]);
  return shell(
    "Demande bien reçue !",
    "Voici le récapitulatif de votre demande. Notre équipe vous recontactera très prochainement.",
    body
  );
}

// ─── team notification email (all fields + attachments) ──────────────────────

function teamHtml(f: B2cPayload, region: string, photoCount: number): string {
  const body =
    section("Coordonnées", [
      ["Nom", `${f.prenom} ${f.nom}`],
      ["Email", f.email],
      ["Téléphone", f.telephone],
      ["Département", f.departement],
      ["Ville", f.ville],
    ]) +
    section("Véhicule", [
      ["Électrique", yesNo(f.electrique)],
      ["Matériel", f.materiel.join(", ")],
      ["Marque", f.marque],
      ["Modèle", f.modele],
      ["Cylindrée", f.cylindree && `${f.cylindree} cc`],
      ["Année", f.annee],
      ["Kilométrage", f.kilometrage && `${f.kilometrage} km`],
      ["Accessoires", f.accessoires],
    ]) +
    section("Clés et télécommandes", [
      ["Clés de contact", yesNo(f.aClesContact)],
      ["Clé noire", f.cleNoire],
      ["Clé marron", f.cleMarron],
      ["Clé rouge", f.cleRouge],
      ["Télécommande / Bip", yesNo(f.aTelecommande)],
      ["Nb télécommandes", f.telecommande],
    ]) +
    section("État", [
      ["État", f.etat],
      ["Nature de la panne", f.naturePanne],
    ]) +
    section("Papiers", [
      ["Carte grise", yesNo(f.carteGrise)],
      ["Carte grise à son nom", yesNo(f.carteGriseAVotreNom)],
      ["Contrôle technique", yesNo(f.controleTechnique)],
      ["CT < 6 mois", yesNo(f.ctMoins6Mois)],
      ["Résultat CT", f.resultatCT],
      ["Certificat de non-gage", yesNo(f.certificatNonGage)],
      ["Carnet d'entretien", yesNo(f.carnetEntretien)],
      ["Facture d'entretien", yesNo(f.factureEntretien)],
    ]) +
    section("Demande", [
      ["Prix souhaité", f.prix && `${f.prix} €`],
      ["Commentaires", f.commentaires],
      ["Reprise", f.modalite],
      ["Photos jointes", String(photoCount)],
    ]);
  return shell(
    `Nouvelle demande B2C — ${region}`,
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
  const region = resolveRegion(payload.departement);

  await send(
    teamRecipient(payload.departement),
    `Nouvelle demande B2C — ${region} — ${payload.prenom} ${payload.nom}`,
    teamHtml(payload, region, attachments.length),
    attachments
  );

  await send(
    customerRecipient(payload.email),
    "Bike-eco — votre demande a bien été reçue",
    customerHtml(payload)
  );
}
