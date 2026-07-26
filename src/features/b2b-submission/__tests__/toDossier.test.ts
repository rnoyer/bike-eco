import type { SessionUser } from "@/lib/auth/session";
import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import { B2B_SUBMISSION_DEFAULTS } from "../schema";
import { regionForDepartement, toDossierPayload } from "../toDossier";

const session: SessionUser = {
  id: "user_b2b_nord",
  role: "b2b",
  companyId: "comp_nord",
  nom: "Durand",
  prenom: "Camille",
  email: "c@x.fr",
  telephone: "0600000000",
  status: "active",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const company = {
  id: "comp_nord",
  name: "Garage du Nord",
  departement: "75 - Paris",
};
const photos = { urls: ["https://x/0.jpg"], thumbnailUrl: "https://x/t.jpg" };

test("région follows the submitter's département", () => {
  expect(regionForDepartement("75 - Paris")).toBe("NORTH");
  expect(regionForDepartement("13 - Bouches-du-Rhône")).toBe("SOUTH");
  expect(regionForDepartement("2A - Corse-du-Sud")).toBe("SOUTH");
  // Unknown départements fall back to NORTH, matching functions/src/regions.ts.
  expect(regionForDepartement("99 - Inconnu")).toBe("NORTH");
});

test("a new dossier is unstarted, unpriced, and owned by the submitter", () => {
  const d = toDossierPayload(B2B_SUBMISSION_DEFAULTS, session, company, photos);
  expect(d.status).toBe("a_traiter");
  expect(d.negotiatedPrice).toBeNull();
  expect(d.companyId).toBe("comp_nord");
  expect(d.submittedBy).toBe("user_b2b_nord");
  expect(d.region).toBe("NORTH");
  // Contact details are denormalized from the session so a B2B teammate — who
  // cannot read the submitter's `users/{uid}` doc — still sees them.
  expect(d.submitter).toEqual({
    nom: "Durand",
    prenom: "Camille",
    companyName: "Garage du Nord",
    email: "c@x.fr",
    telephone: "0600000000",
  });
  expect(d.photos).toEqual(["https://x/0.jpg"]);
  expect(d.thumbnailUrl).toBe("https://x/t.jpg");
});

test("region follows the company's département, not the submitter's", () => {
  // The session stays a NORTH département ("75 - Paris"); if region were still
  // read from the session this would still resolve to NORTH.
  const southCompany = {
    id: "comp_sud",
    name: "Garage du Sud",
    departement: "13 - Bouches-du-Rhône",
  };
  const south = toDossierPayload(
    B2B_SUBMISSION_DEFAULTS,
    session,
    southCompany,
    photos,
  );
  expect(south.region).toBe("SOUTH");

  // Unknown département falls back to NORTH, matching functions/src/regions.ts.
  const unknownCompany = {
    id: "comp_unknown",
    name: "Garage Inconnu",
    departement: "99 - Inconnu",
  };
  const unknown = toDossierPayload(
    B2B_SUBMISSION_DEFAULTS,
    session,
    unknownCompany,
    photos,
  );
  expect(unknown.region).toBe("NORTH");
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
