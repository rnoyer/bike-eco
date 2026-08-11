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
    getUserEmail: async (uid) => {
      const snap = await db().collection("users").doc(uid).get();
      return snap.exists ? ((snap.data()!.email as string) ?? null) : null;
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
