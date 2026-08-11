import { getAuth } from "firebase-admin/auth";

import { authedCall, db } from "../callable";
import { B2C_EMAIL_SECRETS, sendHtmlMail } from "../email";
import { sendDossierRecapCore, type DossierEmailDeps } from "./core";
import type { RecapDossier } from "./render";
import { dossierRecapSchema } from "./schemas";

function dossierEmailDeps(): DossierEmailDeps {
  return {
    // The document is read whole and handed to the renderer as-is: the recap
    // prints every field, so there is nothing to project away.
    getDossier: async (id) => {
      const snap = await db().collection("dossiers").doc(id).get();
      return snap.exists ? (snap.data() as RecapDossier) : null;
    },
    // Read from Firebase Auth, not `users/{uid}.email`: the profile field is
    // client-writable (the security rules block role/companyId/status/isAdmin
    // on update, but not email), so it cannot carry the "always the caller's
    // own address" invariant this callable relies on. The Auth record can only
    // change through re-authentication.
    getUserEmail: async (uid) => {
      const user = await getAuth()
        .getUser(uid)
        .catch((err: unknown) => {
          // Already gone is not this callable's problem to throw on: the caller
          // just ends up with no email, same as any other account with none.
          if ((err as { code?: string })?.code === "auth/user-not-found") return null;
          throw err;
        });
      return user?.email ?? null;
    },
    sendMail: sendHtmlMail,
  };
}

/**
 * Mail the calling back-office user a recap of one dossier.
 *
 * Needs the SMTP secrets: `sendHtmlMail` reads them through `.value()`, which
 * only resolves for a function that declared them.
 */
export const sendDossierRecap = authedCall(
  dossierRecapSchema,
  (input, caller) => sendDossierRecapCore(input, caller, dossierEmailDeps()),
  { secrets: B2C_EMAIL_SECRETS },
);
