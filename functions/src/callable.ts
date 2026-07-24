import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { ZodError } from "zod";

import { RegError, type CallerClaims } from "./registration/core";

// Point the admin SDK at the local emulators in dev. Deployed Gen2 functions
// always run with NODE_ENV="production", so this block is skipped in prod.
if (process.env.NODE_ENV !== "production") {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
}

// Guard against a double-init across every callable module.
if (!getApps().length) initializeApp();

export const db = () => getFirestore(getApp(), "bike-eco-db");

export function callerFrom(
  req: { auth?: { uid: string; token: Record<string, unknown> } },
): CallerClaims {
  const token = req.auth!.token;
  return {
    uid: req.auth!.uid,
    role: token.role as string,
    status: token.status as string,
    companyId: (token.companyId as string) ?? null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function toHttps(err: unknown): never {
  if (err instanceof RegError) throw new HttpsError(err.code, err.message);
  if (err instanceof ZodError) throw new HttpsError("invalid-argument", "Données du formulaire invalides.");

  if (isRecord(err) && typeof err.code === "string") {
    const code = err.code as string;
    if (code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Cette adresse email est déjà utilisée.");
    }
    if (code === "auth/weak-password") {
      throw new HttpsError("invalid-argument", "Le mot de passe doit contenir au moins 8 caractères.");
    }
    if (code === "auth/invalid-password") {
      throw new HttpsError("invalid-argument", "Le mot de passe est invalide.");
    }
  }

  const message = err instanceof Error ? err.message : String(err);
  logger.error("Callable failed", { error: message });
  throw new HttpsError("internal", "Une erreur est survenue. Veuillez réessayer.");
}
