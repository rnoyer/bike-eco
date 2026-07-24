import busboy from "busboy";
import { setGlobalOptions } from "firebase-functions";
import { onRequest } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";

import { B2C_EMAIL_SECRETS, sendB2cEmails, type Attachment } from "./email";
import { b2cPayloadSchema } from "./payload";

export {
  registerCompany, sendInvite, resolveInvite, acceptInvite,
  approveCompany, deleteCompany,
} from "./registration";

// Per-function caps still apply; this bounds the blast radius of autoscaling.
setGlobalOptions({ maxInstances: 10 });

// Upload guard rails — reject oversized payloads instead of buffering them.
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB per photo
const MAX_FILES = 12;
const MAX_FIELD_BYTES = 100 * 1024; // JSON payload is a few KB

/**
 * Public B2C funnel submission endpoint.
 *
 * Accepts multipart/form-data: a `payload` JSON field (the form, minus photos)
 * plus N `photos` files. Sends the team notification (with the photos attached)
 * and the customer recap. Nothing is persisted.
 *
 * Concurrency: image buffers are held in memory, so per-instance concurrency is
 * capped and memory raised; autoscaling bursts up to maxInstances.
 */
export const sendB2cSubmission = onRequest(
  {
    memory: "512MiB",
    concurrency: 15,
    cors: true,
    secrets: B2C_EMAIL_SECRETS,
  },
  (req, res): void => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ error: "Expected multipart/form-data." });
      return;
    }

    const bb = busboy({
      headers: req.headers,
      limits: {
        fileSize: MAX_FILE_BYTES,
        files: MAX_FILES,
        fields: 5,
        fieldSize: MAX_FIELD_BYTES,
      },
    });

    let payloadRaw = "";
    const attachments: Attachment[] = [];
    let rejected: { status: number; error: string } | null = null;

    bb.on("field", (name, value) => {
      if (name === "payload") payloadRaw = value;
    });

    bb.on("file", (_name, stream, info) => {
      // Only accept image attachments; drain anything else.
      if (!info.mimeType.startsWith("image/")) {
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("limit", () => {
        rejected = { status: 413, error: "Une photo dépasse la taille maximale (8 Mo)." };
        stream.resume();
      });
      stream.on("end", () => {
        if (rejected) return;
        attachments.push({
          filename: info.filename || `photo-${attachments.length + 1}.jpg`,
          content: Buffer.concat(chunks),
          contentType: info.mimeType,
        });
      });
    });

    bb.on("filesLimit", () => {
      rejected = { status: 413, error: `Trop de photos (max ${MAX_FILES}).` };
    });

    bb.on("error", (err) => {
      logger.error("Multipart parse error", err);
      if (!res.headersSent) res.status(400).json({ error: "Requête invalide." });
    });

    bb.on("close", async () => {
      if (rejected) {
        res.status(rejected.status).json({ error: rejected.error });
        return;
      }

      let json: unknown;
      try {
        json = JSON.parse(payloadRaw);
      } catch {
        res.status(400).json({ error: "Payload JSON invalide." });
        return;
      }

      const parsed = b2cPayloadSchema.safeParse(json);
      if (!parsed.success) {
        logger.warn("Payload validation failed", parsed.error.issues);
        res.status(400).json({ error: "Données du formulaire invalides." });
        return;
      }

      if (attachments.length < 1) {
        res.status(400).json({ error: "Au moins une photo est requise." });
        return;
      }

      try {
        await sendB2cEmails(parsed.data, attachments);
        res.status(200).json({ ok: true });
      } catch (err) {
        // onRequest is not auto-retried; surface the failure to the client.
        logger.error("Failed to send B2C emails", err);
        res.status(502).json({ error: "Échec de l'envoi des emails." });
      }
    });

    // 2nd-gen onRequest pre-reads the body into rawBody.
    if (req.rawBody) bb.end(req.rawBody);
    else req.pipe(bb);
  }
);
