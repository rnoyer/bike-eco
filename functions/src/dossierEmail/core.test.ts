import { describe, expect, test } from "@jest/globals";
import type { CallerClaims } from "../errors";
import { sendDossierRecapCore, type DossierEmailDeps } from "./core";
import type { RecapDossier } from "./render";

const backoffice: CallerClaims = {
  uid: "bo1",
  role: "backoffice",
  status: "active",
  companyId: null,
};
const dealer: CallerClaims = {
  uid: "b2b1",
  role: "b2b",
  status: "active",
  companyId: "comp_1",
};
const pendingBackoffice: CallerClaims = {
  uid: "bo2",
  role: "backoffice",
  status: "pending",
  companyId: null,
};

const DOSSIER: RecapDossier = {
  status: "en_cours",
  region: "SOUTH",
  validatedPrice: null,
  createdAt: { toDate: () => new Date("2026-07-26T12:30:00Z") },
  submitter: {
    nom: "Durand",
    prenom: "Claire",
    companyName: "Moto Sud",
    email: "claire@moto-sud.fr",
    telephone: "0601020304",
  },
  vehicle: {
    stock: "oui",
    immatriculation: "AB-123-CD",
    electrique: "non",
    materiel: [],
    marque: "Yamaha",
    modele: "MT-07 689",
    annee: 2019,
    kilometrage: 48000,
    accessoires: "",
  },
  keys: {
    aClesContact: "oui",
    cleNoire: 2,
    cleMarron: null,
    cleRouge: null,
    aKeyless: "non",
    keyless: [],
  },
  condition: { etat: "Bon état", naturePanne: "" },
  papers: {
    carteGrise: "oui",
    carteGriseAVotreNom: "oui",
    controleTechnique: "non",
    ctMoins6Mois: null,
    resultatCT: null,
    certificatNonGage: "oui",
    carnetEntretien: "non",
    factureEntretien: "non",
  },
  pricing: { prix: 3500, commentaires: "" },
};

interface Sent {
  to: string;
  subject: string;
  html: string;
}

function fakeDeps(over: Partial<DossierEmailDeps> = {}): DossierEmailDeps & {
  sent: Sent[];
  getDossierCalls: () => number;
} {
  const sent: Sent[] = [];
  let getDossierCalls = 0;
  const merged: DossierEmailDeps = {
    getDossier: async () => DOSSIER,
    getUserEmail: async () => "agent@bike-eco.fr",
    sendMail: async (mail) => {
      sent.push(mail);
    },
    ...over,
  };
  return {
    sent,
    getDossierCalls: () => getDossierCalls,
    getDossier: async (id) => {
      // Counted so a regression that checks dossier existence before the
      // role/status guard is caught: it would still pass every other
      // assertion here while leaking dossier existence through
      // not-found vs. permission-denied to a caller who should see neither.
      getDossierCalls++;
      return merged.getDossier(id);
    },
    getUserEmail: merged.getUserEmail,
    sendMail: merged.sendMail,
  };
}

describe("sendDossierRecapCore", () => {
  test("mails the back-office caller their own address", async () => {
    const d = fakeDeps();
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(d.sent).toHaveLength(1);
    expect(d.sent[0].to).toBe("agent@bike-eco.fr");
    expect(d.sent[0].subject).toBe(
      "Demande de rachat - Moto Sud - Yamaha MT-07 689",
    );
    expect(d.sent[0].html).toContain("Informations véhicule");
  });

  test("resolves the recipient from the caller's uid, never from the payload", async () => {
    const seen: string[] = [];
    const d = fakeDeps({
      getUserEmail: async (uid) => {
        seen.push(uid);
        return "agent@bike-eco.fr";
      },
    });
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(seen).toEqual(["bo1"]);
  });

  test("refuses a b2b caller, without sending anything", async () => {
    const d = fakeDeps();
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, dealer, d),
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Action non autorisée.",
    });
    expect(d.sent).toHaveLength(0);
    expect(d.getDossierCalls()).toBe(0);
  });

  test("refuses a caller with no role claim at all", async () => {
    const d = fakeDeps();
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, { uid: "x" }, d),
    ).rejects.toMatchObject({ code: "permission-denied" });
    expect(d.sent).toHaveLength(0);
    expect(d.getDossierCalls()).toBe(0);
  });

  test("refuses a back-office caller whose status is not active, without sending anything", async () => {
    const d = fakeDeps();
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, pendingBackoffice, d),
    ).rejects.toMatchObject({
      code: "permission-denied",
      message: "Action réservée aux comptes actifs.",
    });
    expect(d.sent).toHaveLength(0);
    expect(d.getDossierCalls()).toBe(0);
  });

  test("reports a missing dossier", async () => {
    const d = fakeDeps({ getDossier: async () => null });
    await expect(
      sendDossierRecapCore({ dossierId: "nope" }, backoffice, d),
    ).rejects.toMatchObject({
      code: "not-found",
      message: "Dossier introuvable.",
    });
    expect(d.sent).toHaveLength(0);
  });

  test("reports an account with no email on file", async () => {
    const d = fakeDeps({ getUserEmail: async () => null });
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d),
    ).rejects.toMatchObject({
      code: "failed-precondition",
      message: "Aucune adresse email n'est associée à votre compte.",
    });
    expect(d.sent).toHaveLength(0);
  });

  test("treats a blank email as no email", async () => {
    const d = fakeDeps({ getUserEmail: async () => "   " });
    await expect(
      sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d),
    ).rejects.toMatchObject({ code: "failed-precondition" });
    expect(d.sent).toHaveLength(0);
  });
});
