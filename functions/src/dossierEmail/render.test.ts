import { describe, expect, test } from "@jest/globals";
import { recapHtml, recapSubject, type RecapDossier } from "./render";

/** A fully answered dossier. Tests narrow it with `dossier({ ... })`. */
const FULL: RecapDossier = {
  status: "en_cours",
  region: "SOUTH",
  validatedPrice: 3200,
  createdAt: { toDate: () => new Date("2026-07-26T12:30:00Z") },
  submitter: {
    nom: "Durand",
    prenom: "Claire",
    companyName: "Garage Lambert",
    email: "claire@moto-sud.fr",
    telephone: "0601020304",
  },
  vehicle: {
    electrique: "oui",
    materiel: ["J'ai la batterie"],
    marque: "Yamaha",
    modele: "MT-07 689",
    annee: 2019,
    kilometrage: 48000,
    accessoires: "Sacoches neuves",
  },
  keys: {
    aClesContact: "oui",
    cleNoire: 2,
    cleMarron: 0,
    cleRouge: null,
    aTelecommande: "oui",
    telecommande: 1,
  },
  condition: { etat: "En Panne", naturePanne: "Démarreur HS" },
  papers: {
    carteGrise: "oui",
    carteGriseAVotreNom: "oui",
    controleTechnique: "oui",
    ctMoins6Mois: "non",
    resultatCT: "Favorable",
    certificatNonGage: "oui",
    carnetEntretien: "non",
    factureEntretien: "oui",
  },
  pricing: { prix: 3500, commentaires: "Vente rapide souhaitée" },
};

const dossier = (over: Partial<RecapDossier> = {}): RecapDossier => ({
  ...FULL,
  ...over,
});

describe("recapSubject", () => {
  test("names the company and the vehicle", () => {
    expect(recapSubject(FULL)).toBe(
      "Demande de rachat - Garage Lambert - Yamaha MT-07 689",
    );
  });
});

describe("recapHtml", () => {
  test("opens with the subject and the intro sentence", () => {
    const html = recapHtml(FULL);
    expect(html).toContain(
      "Demande de rachat - Garage Lambert - Yamaha MT-07 689",
    );
    expect(html).toContain(
      "Veuillez trouver le récapitulatif de la demande de rachat soumise dans l'application Bike-eco par Claire Durand, de Garage Lambert.",
    );
  });

  test("carries the three sections, in reading order", () => {
    const html = recapHtml(FULL);
    const vehicule = html.indexOf("Informations véhicule");
    const vendeur = html.indexOf("Informations vendeur");
    const dossierSection = html.indexOf("Informations Dossier");
    expect(vehicule).toBeGreaterThan(-1);
    expect(vendeur).toBeGreaterThan(vehicule);
    expect(dossierSection).toBeGreaterThan(vendeur);
  });

  test("renders the vehicle's own values with their units", () => {
    const html = recapHtml(FULL);
    expect(html).toContain("Prix souhaité");
    expect(html).toContain("3500 €");
    expect(html).toContain("48000 km");
    expect(html).toContain("2019");
    expect(html).toContain("MT-07 689");
  });

  test("renders the seller block from the denormalized submitter", () => {
    const html = recapHtml(FULL);
    // "Entreprise" and "Prénom" are unique labels, but plain "Nom" is a
    // substring of the "Nombre" row (télécommande count), which is also on
    // the page — so it's matched against the exact `>Nom<` table cell
    // instead, which only the seller's Nom row renders.
    expect(html).toContain("Entreprise");
    expect(html).toContain(">Nom<");
    expect(html).toContain("Prénom");
    expect(html).toContain("Garage Lambert");
    expect(html).toContain("Durand");
    expect(html).toContain("Claire");
    expect(html).toContain("0601020304");
    expect(html).toContain("claire@moto-sud.fr");
  });

  test("renders the dossier block with French status, région and date", () => {
    const html = recapHtml(FULL);
    expect(html).toContain("En cours");
    expect(html).toContain("Région");
    expect(html).toContain("Sud");
    expect(html).toContain("3200 €");
    expect(html).toContain("26 juil. 2026 14:30");
  });

  test("prints the back office's own status verbatim", () => {
    // No `viewerStatus` projection: the reader is always the back office.
    expect(recapHtml(dossier({ status: "a_traiter" }))).toContain("À traiter");
  });

  test("reveals the électrique sub-answers only when électrique is oui", () => {
    expect(recapHtml(FULL)).toContain("Batterie présente");
    expect(recapHtml(FULL)).toContain("Chargeur présent");
    const thermique = dossier({
      vehicle: { ...FULL.vehicle, electrique: "non", materiel: [] },
    });
    expect(recapHtml(thermique)).not.toContain("Batterie présente");
    expect(recapHtml(thermique)).not.toContain("Chargeur présent");
  });

  test("reveals the nature de la panne only for a dossier En Panne", () => {
    expect(recapHtml(FULL)).toContain("Démarreur HS");
    const bon = dossier({
      condition: { etat: "Bon état", naturePanne: "Démarreur HS" },
    });
    expect(recapHtml(bon)).not.toContain("Démarreur HS");
  });

  test("reveals the papers sub-answers only when their parent is oui", () => {
    const html = recapHtml(FULL);
    expect(html).toContain("À votre nom");
    expect(html).toContain("Résultat obtenu");
    const sansPapiers = dossier({
      papers: {
        ...FULL.papers,
        carteGrise: "non",
        carteGriseAVotreNom: null,
        controleTechnique: "non",
        ctMoins6Mois: null,
        resultatCT: null,
      },
    });
    const html2 = recapHtml(sansPapiers);
    expect(html2).not.toContain("À votre nom");
    expect(html2).not.toContain("Résultat obtenu");
  });

  test("reveals the key counts only when there are keys", () => {
    expect(recapHtml(FULL)).toContain("Clé noire");
    const sansCles = dossier({
      keys: { ...FULL.keys, aClesContact: "non", cleNoire: null },
    });
    expect(recapHtml(sansCles)).not.toContain("Clé noire");
  });

  test("keeps a zero count but drops an unanswered one", () => {
    // FULL has cleMarron: 0 and cleRouge: null. Zero keys of a colour is an
    // answer; a null is a question the funnel never asked.
    const html = recapHtml(FULL);
    expect(html).toContain("Clé marron");
    expect(html).not.toContain("Clé rouge");
  });

  test("drops a row the funnel never answered", () => {
    const html = recapHtml(
      dossier({
        vehicle: { ...FULL.vehicle, annee: null, kilometrage: null },
        pricing: { prix: null, commentaires: "" },
        validatedPrice: null,
      }),
    );
    expect(html).not.toContain("Année");
    expect(html).not.toContain("Kilométrage");
    expect(html).not.toContain("Prix souhaité");
    expect(html).not.toContain("Prix validé");
    // And no dash ever reaches the page.
    expect(html).not.toContain("—");
  });

  test("escapes free text instead of letting it into the markup", () => {
    const html = recapHtml(
      dossier({ pricing: { prix: 3500, commentaires: "<script>alert(1)</script>" } }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
