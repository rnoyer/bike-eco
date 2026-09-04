import { describe, expect, test } from "@jest/globals";
import { recapHtml, recapSubject, type RecapDossier } from "./render";

/** A dossier photo as it is stored: a Storage download URL with its token. */
const PHOTO_URL = (index: number) =>
  "https://firebasestorage.googleapis.com/v0/b/bkt/o/" +
  `dossiers%2Fcomp_1%2Fdos_1%2Fphotos%2F${index}.jpg?alt=media&token=t${index}`;

/** A fully answered dossier. Tests narrow it with `dossier({ ... })`. */
const FULL: RecapDossier = {
  companyId: "comp_1",
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
    stock: "oui",
    immatriculation: "AB-123-CD",
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
    aKeyless: "oui",
    keyless: ["Code"],
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
  photos: [PHOTO_URL(0), PHOTO_URL(1)],
};

/** Fixed clock, so a rendered recap is a function of its inputs alone. */
const NOW = new Date("2026-08-11T07:06:21Z");

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
    const html = recapHtml(FULL, NOW);
    expect(html).toContain(
      "Demande de rachat - Garage Lambert - Yamaha MT-07 689",
    );
    expect(html).toContain(
      "Veuillez trouver le récapitulatif de la demande de rachat soumise dans l'application Bike-eco par Claire Durand, de Garage Lambert.",
    );
  });

  test("carries the four sections, in reading order", () => {
    const html = recapHtml(FULL, NOW);
    const vehicule = html.indexOf("Informations véhicule");
    const vendeur = html.indexOf("Informations vendeur");
    const dossierSection = html.indexOf("Informations Dossier");
    const photos = html.indexOf("Photos du véhicule");
    expect(vehicule).toBeGreaterThan(-1);
    expect(vendeur).toBeGreaterThan(vehicule);
    expect(dossierSection).toBeGreaterThan(vendeur);
    expect(photos).toBeGreaterThan(dossierSection);
  });

  test("renders the vehicle's own values with their units", () => {
    const html = recapHtml(FULL, NOW);
    expect(html).toContain("Prix souhaité");
    expect(html).toContain("3500 €");
    expect(html).toContain("48000 km");
    expect(html).toContain("2019");
    expect(html).toContain("MT-07 689");
  });

  test("renders the seller block from the denormalized submitter", () => {
    const html = recapHtml(FULL, NOW);
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
    const html = recapHtml(FULL, NOW);
    expect(html).toContain("En cours");
    expect(html).toContain("Région");
    expect(html).toContain("Sud");
    expect(html).toContain("3200 €");
    expect(html).toContain("26 juil. 2026 14:30");
  });

  test("prints the back office's own status verbatim", () => {
    // No `viewerStatus` projection: the reader is always the back office.
    expect(recapHtml(dossier({ status: "a_traiter" }), NOW)).toContain("À traiter");
  });

  /**
   * The value `rowsHtml` rendered for one label, or `null` when the row was
   * dropped. Asserting on this rather than on `toContain(label)` is what makes
   * the derived Oui/Non rows testable at all: a sub-row's *label* is emitted
   * whenever its parent answer is "oui", whatever the value works out to, so a
   * `toContain` assertion passes even when every answer is wrong.
   *
   * That matters here specifically. `MATERIEL_*` / `KEYLESS_*` and the
   * `hasMateriel` / `hasKeyless` helpers are duplicated in `../labels` because
   * this package cannot import app sources — if that copy drifts from
   * `src/constants/vehicle.ts`, or the two labels of a pair get swapped, every
   * recap silently prints "Non" for equipment the dossier actually has.
   */
  const rowValue = (html: string, label: string): string | null => {
    const m = html.match(new RegExp(`>${label}</td><td[^>]*>([^<]*)</td>`));
    return m ? m[1] : null;
  };

  test("reveals the électrique sub-answers only when électrique is oui", () => {
    const html = recapHtml(FULL, NOW);
    // FULL has the batterie and not the chargeur.
    expect(rowValue(html, "Batterie présente")).toBe("Oui");
    expect(rowValue(html, "Chargeur présent")).toBe("Non");
    const thermique = dossier({
      vehicle: { ...FULL.vehicle, electrique: "non", materiel: [] },
    });
    expect(recapHtml(thermique, NOW)).not.toContain("Batterie présente");
    expect(recapHtml(thermique, NOW)).not.toContain("Chargeur présent");
  });

  test("reveals the nature de la panne only for a dossier En Panne", () => {
    expect(recapHtml(FULL, NOW)).toContain("Démarreur HS");
    const bon = dossier({
      condition: { etat: "Bon état", naturePanne: "Démarreur HS" },
    });
    expect(recapHtml(bon, NOW)).not.toContain("Démarreur HS");
  });

  test("reveals the papers sub-answers only when their parent is oui", () => {
    const html = recapHtml(FULL, NOW);
    expect(html).toContain("Au nom du garage");
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
    const html2 = recapHtml(sansPapiers, NOW);
    expect(html2).not.toContain("Au nom du garage");
    expect(html2).not.toContain("Résultat obtenu");
  });

  test("reveals the key counts only when there are keys", () => {
    expect(recapHtml(FULL, NOW)).toContain("Clé noire");
    const sansCles = dossier({
      keys: { ...FULL.keys, aClesContact: "non", cleNoire: null },
    });
    expect(recapHtml(sansCles, NOW)).not.toContain("Clé noire");
  });

  test("reveals the keyless sub-answers only when there is a keyless system", () => {
    const html = recapHtml(FULL, NOW);
    // FULL ticked "Code" and not "Clé de secours".
    expect(rowValue(html, "Code")).toBe("Oui");
    expect(rowValue(html, "Clé de secours")).toBe("Non");
    const sansKeyless = dossier({
      keys: { ...FULL.keys, aKeyless: "non", keyless: [] },
    });
    expect(recapHtml(sansKeyless, NOW)).not.toContain("Clé de secours");
  });

  test("prints the plate and the stock answer", () => {
    const html = recapHtml(FULL, NOW);
    expect(html).toContain("AB-123-CD");
    expect(html).toContain("Déjà en stock");
    // Unanswered rows are dropped rather than dashed.
    const sansStock = dossier({
      vehicle: { ...FULL.vehicle, stock: null, immatriculation: "" },
    });
    const html2 = recapHtml(sansStock, NOW);
    expect(html2).not.toContain("Déjà en stock");
    expect(html2).not.toContain("Immatriculation");
  });

  test("keeps a zero count but drops an unanswered one", () => {
    // FULL has cleMarron: 0 and cleRouge: null. Zero keys of a colour is an
    // answer; a null is a question the funnel never asked.
    const html = recapHtml(FULL, NOW);
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
      NOW,
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
      NOW,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("generation timestamp", () => {
  test("stamps when the recap was generated, in Paris time", () => {
    const html = recapHtml(FULL, NOW);
    expect(html).toContain("Récapitulatif généré le");
    expect(html).toContain("11 août 2026 09:06:21");
  });

  // The reason the row exists: Gmail threads messages sharing a subject and
  // hides whatever repeats an earlier one, so two byte-identical recaps of an
  // unchanged dossier arrive looking blank.
  test("two recaps of an unchanged dossier are not byte-identical", () => {
    const a = recapHtml(FULL, new Date("2026-08-11T07:06:21Z"));
    const b = recapHtml(FULL, new Date("2026-08-11T07:06:22Z"));
    expect(a).not.toBe(b);
  });
});

describe("photos", () => {
  test("links every photo, numbered from 1 and named after the vehicle", () => {
    const html = recapHtml(FULL, NOW);
    expect(html).toContain(`href="${PHOTO_URL(0).replace(/&/g, "&amp;")}"`);
    expect(html).toContain("Photo Yamaha MT-07 689 n°1");
    expect(html).toContain(`href="${PHOTO_URL(1).replace(/&/g, "&amp;")}"`);
    expect(html).toContain("Photo Yamaha MT-07 689 n°2");
  });

  test("omits the whole section when the dossier carries no photo", () => {
    expect(recapHtml(dossier({ photos: [] }), NOW)).not.toContain("Photos du véhicule");
    expect(recapHtml(dossier({ photos: undefined }), NOW)).not.toContain(
      "Photos du véhicule",
    );
  });
});
