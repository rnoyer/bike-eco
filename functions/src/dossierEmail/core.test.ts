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

const BUCKET = "bike-eco-43a84.firebasestorage.app";
/** A dossier photo as it is stored: a Storage download URL with its token. */
const PHOTO_URL = (index: number, bucket = BUCKET) =>
  `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/` +
  `dossiers%2Fcomp_1%2Fdos_1%2Fphotos%2F${index}.jpg?alt=media&token=t${index}`;

const DOSSIER: RecapDossier = {
  companyId: "comp_1",
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
  photos: [PHOTO_URL(0)],
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
    storageBucket: BUCKET,
    getDossier: async () => DOSSIER,
    getUserEmail: async () => "agent@bike-eco.fr",
    sendMail: async (mail) => {
      sent.push(mail);
    },
    ...over,
  };
  return {
    sent,
    storageBucket: merged.storageBucket,
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

// `dossiers/{id}.photos` is written by the dealer's own client and the create
// rule does not constrain it, so the recap only links what it can tie to this
// dossier — otherwise a dealer could plant a link in a back-office mailbox.
describe("photo links", () => {
  const photosOf = (html: string) => html.match(/href="([^"]+)"/g) ?? [];

  const withPhotos = (photos: string[], bucket: string | null = BUCKET) =>
    fakeDeps({
      storageBucket: bucket,
      getDossier: async () => ({ ...DOSSIER, photos }),
    });

  test("links a photo of this dossier in our own bucket", async () => {
    const d = withPhotos([PHOTO_URL(0)]);
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(d.sent[0].html).toContain("Photos du véhicule");
    expect(photosOf(d.sent[0].html)).toHaveLength(1);
    expect(d.sent[0].html).toContain("Photo Yamaha MT-07 689 n°1");
  });

  test("drops an external link and one in someone else's bucket", async () => {
    const d = withPhotos([
      "https://evil.example/phish.html",
      PHOTO_URL(0, "attacker-project.firebasestorage.app"),
    ]);
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(d.sent[0].html).not.toContain("evil.example");
    expect(d.sent[0].html).not.toContain("attacker-project");
    expect(d.sent[0].html).not.toContain("Photos du véhicule");
  });

  test("drops a photo belonging to another dossier", async () => {
    const other = PHOTO_URL(0).replace("dos_1", "dos_9");
    const d = withPhotos([other]);
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(d.sent[0].html).not.toContain("dos_9");
  });

  test("numbers the links that survive, from 1", async () => {
    const d = withPhotos(["https://evil.example/x.jpg", PHOTO_URL(1), PHOTO_URL(2)]);
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(d.sent[0].html).toContain("Photo Yamaha MT-07 689 n°1");
    expect(d.sent[0].html).toContain("Photo Yamaha MT-07 689 n°2");
    expect(d.sent[0].html).not.toContain("n°3");
  });

  test("still links this dossier's photos when the bucket is unknown", async () => {
    const d = withPhotos([PHOTO_URL(0)], null);
    await sendDossierRecapCore({ dossierId: "dos_1" }, backoffice, d);
    expect(photosOf(d.sent[0].html)).toHaveLength(1);
  });
});
