import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, type CallableOptions } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { z, ZodError, type ZodType } from "zod";

import { RegError, type CallerClaims } from "./errors";

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

// ─── callable wrappers ───────────────────────────────────────────────────────
//
// Every callable in this codebase does the same four things: reject the caller
// when authentication is required, parse `req.data` with a Zod schema, run the
// module's `core` with the *verified* claims, and funnel any failure through
// `toHttps`. These two wrappers own that sequence so a new callable cannot
// forget the auth guard or leak a raw error — the two mistakes the shape exists
// to prevent. Logic still belongs in `core.ts`; these only do the wiring.

/**
 * A `core` that resolves to nothing gets the `{ ok: true }` acknowledgement the
 * client's `call()` expects; one that resolves to a value returns it verbatim.
 */
async function respond<R>(result: R): Promise<R | { ok: true }> {
  return result === undefined ? { ok: true } : result;
}

/** For a callable that takes no payload — `req.data` is ignored, not trusted. */
export const NO_PAYLOAD = z.unknown();

/**
 * A callable only a signed-in user may invoke. `run` receives the parsed input
 * and the claims read from the verified ID token (never from `req.data`).
 */
export function authedCall<I, R>(
  schema: ZodType<I>,
  run: (input: I, caller: CallerClaims) => Promise<R>,
  options: CallableOptions = {},
) {
  return onCall(options, async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
    try {
      return await respond(await run(schema.parse(req.data), callerFrom(req)));
    } catch (e) {
      toHttps(e);
    }
  });
}

/**
 * A callable reachable while signed out — the registration and invitation flows,
 * which run before the user has an account (or, for a Google sign-up, with a
 * half-built one). `run` gets whatever identity the request happened to carry;
 * both fields are null for a fully anonymous caller.
 */
export function publicCall<I, R>(
  schema: ZodType<I>,
  run: (
    input: I,
    identity: { uid: string | null; email: string | null },
  ) => Promise<R>,
  options: CallableOptions = {},
) {
  return onCall(options, async (req) => {
    try {
      const identity = {
        uid: req.auth?.uid ?? null,
        email: (req.auth?.token.email as string | undefined) ?? null,
      };
      return await respond(await run(schema.parse(req.data), identity));
    } catch (e) {
      toHttps(e);
    }
  });
}
