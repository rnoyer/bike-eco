import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import type { SessionUser } from "@/lib/auth/session";
import { B2B_SUBMISSION_DEFAULTS } from "../schema";
import { regionForDepartement, toDossierPayload } from "../toDossier";

const session: SessionUser = {
  id: "user_b2b",
  role: "b2b",
  companyId: "comp_nord",
  region: null,
  nom: "Durand",
  prenom: "Camille",
  email: "c@x.fr",
  telephone: "0600000000",
  departement: "75 - Paris",
  ville: "Paris",
  status: "active",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const company = { id: "comp_nord", name: "Garage du Nord" };
const photos = { urls: ["https://x/0.jpg"], thumbnailUrl: "https://x/t.jpg" };

test("région follows the submitter's département", () => {
  expect(regionForDepartement("75 - Paris")).toBe("NORTH");
  expect(regionForDepartement("13 - Bouches-du-Rhône")).toBe("SOUTH");
  expect(regionForDepartement("2A - Corse-du-Sud")).toBe("SOUTH");
  // Unknown départements fall back to NORTH, matching functions/src/regions.ts.
  expect(regionForDepartement("99 - Inconnu")).toBe("NORTH");
});

test("a new dossier is unstarted, unpriced, and owned by the submitter", () => {
  const d = toDossierPayload(
    B2B_SUBMISSION_DEFAULTS,
    session,
    company,
    photos,
  );
  expect(d.status).toBe("a_traiter");
  expect(d.negotiatedPrice).toBeNull();
  expect(d.companyId).toBe("comp_nord");
  expect(d.submittedBy).toBe("user_b2b");
  expect(d.region).toBe("NORTH");
  expect(d.submitter).toEqual({
    nom: "Durand",
    prenom: "Camille",
    companyName: "Garage du Nord",
  });
  expect(d.photos).toEqual(["https://x/0.jpg"]);
  expect(d.thumbnailUrl).toBe("https://x/t.jpg");
});

test("numeric strings are coerced and blanks become null", () => {
  const d = toDossierPayload(
    {
      ...B2B_SUBMISSION_DEFAULTS,
      annee: "2019",
      kilometrage: "18 450",
      prix: "5000",
      cleNoire: "2",
      telecommande: null,
    },
    session,
    company,
    photos,
  );
  expect(d.vehicle.annee).toBe(2019);
  expect(d.vehicle.kilometrage).toBe(18450);
  expect(d.pricing.prix).toBe(5000);
  expect(d.keys.cleNoire).toBe(2);
  expect(d.keys.telecommande).toBeNull();
  // The B2B funnel merges "Modèle et Cylindrée" into `modele`.
  expect(d.vehicle.cylindree).toBeNull();
});

test("input with no digits is unanswered, not zero", () => {
  const d = toDossierPayload(
    { ...B2B_SUBMISSION_DEFAULTS, annee: "abc", kilometrage: "  ", prix: "" },
    session,
    company,
    photos,
  );
  // `Number("")` is 0, so a naive coercion would record year 0 and a free bike
  // rather than "not answered".
  expect(d.vehicle.annee).toBeNull();
  expect(d.vehicle.kilometrage).toBeNull();
  expect(d.pricing.prix).toBeNull();
});

test("free text is trimmed and oui/non answers are narrowed", () => {
  const d = toDossierPayload(
    {
      ...B2B_SUBMISSION_DEFAULTS,
      marque: "  Yamaha ",
      modele: " MT-07 ",
      accessoires: "  Top-case ",
      aClesContact: "oui",
      carteGrise: "non",
      etat: "Bon état",
      resultatCT: "Favorable",
    },
    session,
    company,
    photos,
  );
  expect(d.vehicle.marque).toBe("Yamaha");
  expect(d.vehicle.modele).toBe("MT-07");
  expect(d.vehicle.accessoires).toBe("Top-case");
  expect(d.keys.aClesContact).toBe("oui");
  expect(d.papers.carteGrise).toBe("non");
  expect(d.condition.etat).toBe("Bon état");
  expect(d.papers.resultatCT).toBe("Favorable");
});
