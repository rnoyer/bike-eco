import { linkSection, section, shell, type Link, type Row } from "../emailHtml";
import {
  euros,
  generatedAt,
  hasKeyless,
  hasMateriel,
  kilometres,
  ouiNon,
  REGION_LABELS,
  STATUS_LABELS,
  submittedAt,
  type DossierStatus,
  type OuiNon,
  type Region,
} from "../labels";

/**
 * The subset of a `dossiers/{id}` document the recap needs — which is all of
 * it bar the thumbnail and the audit fields.
 *
 * `createdAt` is typed structurally rather than as a `Timestamp` so this module
 * needs no Firebase import and stays testable with a plain object.
 */
export interface RecapDossier {
  status: DossierStatus;
  region: Region;
  validatedPrice: number | null;
  createdAt: { toDate(): Date } | null;
  submitter: {
    nom: string;
    prenom: string;
    companyName: string;
    email: string;
    telephone: string;
  };
  vehicle: {
    stock: OuiNon | null;
    immatriculation: string;
    electrique: OuiNon;
    materiel: string[];
    marque: string;
    modele: string;
    annee: number | null;
    kilometrage: number | null;
    accessoires: string;
  };
  keys: {
    aClesContact: OuiNon | null;
    cleNoire: number | null;
    cleMarron: number | null;
    cleRouge: number | null;
    aKeyless: OuiNon | null;
    keyless: string[];
  };
  condition: { etat: string | null; naturePanne: string };
  papers: {
    carteGrise: OuiNon | null;
    carteGriseAVotreNom: OuiNon | null;
    controleTechnique: OuiNon | null;
    ctMoins6Mois: OuiNon | null;
    resultatCT: string | null;
    certificatNonGage: OuiNon | null;
    carnetEntretien: OuiNon | null;
    factureEntretien: OuiNon | null;
  };
  pricing: { prix: number | null; commentaires: string };
  /** Not printed: it scopes the photo URLs `core.ts` accepts. */
  companyId: string;
  /** Storage download URLs, in upload order: the first is "n°1". Optional
   *  because it is read straight off the document, and a dossier filed with no
   *  photo carries no array at all. */
  photos?: string[];
}

/** The dossier screen's collapsibles, flattened: sub-rows only exist when
 *  their parent answer was "oui" — the funnel leaves them null otherwise. */
const when = (answer: string | null | undefined, rows: Row[]): Row[] =>
  answer === "oui" ? rows : [];

/**
 * A number that may be unanswered. `null` — not "—": `rowsHtml` drops a row
 * whose value is empty, and a dash is not empty, so dashing here would print
 * every unanswered field instead of dropping it. `0` still renders, because
 * zero keys of a colour is an answer.
 */
const num = (n: number | null | undefined): string | null =>
  n === null || n === undefined ? null : String(n);

/** "Marque Modèle". */
const vehicleLabel = (d: RecapDossier): string =>
  [d.vehicle.marque, d.vehicle.modele].filter(Boolean).join(" ");

/** The subject, also used as the email's heading. */
export function recapSubject(d: RecapDossier): string {
  return `Demande de rachat - ${d.submitter.companyName} - ${vehicleLabel(d)}`;
}

function intro(d: RecapDossier): string {
  const { prenom, nom, companyName } = d.submitter;
  return (
    "Veuillez trouver le récapitulatif de la demande de rachat soumise dans " +
    `l'application Bike-eco par ${prenom} ${nom}, de ${companyName}.`
  );
}

/**
 * Every row the dossier screen shows, in its order, with the collapsibles
 * flattened. `rowsHtml` drops rows whose value is empty, so an unanswered
 * field simply does not appear.
 */
function vehicleSection(d: RecapDossier): string {
  const { vehicle, keys, condition, papers, pricing } = d;
  return section("Informations véhicule", [
    ["Prix souhaité", pricing.prix === null ? null : euros(pricing.prix)],
    ["Marque", vehicle.marque],
    ["Modèle et Cylindrée", vehicle.modele],
    ["Immatriculation", vehicle.immatriculation],
    ["Année", num(vehicle.annee)],
    [
      "Kilométrage",
      vehicle.kilometrage === null ? null : kilometres(vehicle.kilometrage),
    ],
    ["Déjà en stock", ouiNon(vehicle.stock)],
    ["Électrique", ouiNon(vehicle.electrique)],
    ...when(vehicle.electrique, [
      ["Batterie présente", hasMateriel(vehicle.materiel, "batterie") ? "Oui" : "Non"],
      ["Chargeur présent", hasMateriel(vehicle.materiel, "chargeur") ? "Oui" : "Non"],
    ]),
    ["État", condition.etat],
    // Free text, and only ever filled for this one état. `condition.etat` is
    // typed `string | null` here rather than the app's `EtatVehicule` union
    // (src/constants/vehicle.ts, `ETAT_OPTIONS`) because this package cannot
    // import client code — so a typo in the literal below would not fail to
    // compile the way it does on the app's dossier screen.
    ["Nature de la panne", condition.etat === "En Panne" ? condition.naturePanne : null],
    ["Carte grise", ouiNon(papers.carteGrise)],
    // Dossiers only ever come from the B2B funnel, which asks a dealer whether
    // the déclaration d'achat was filed under the garage's name rather than
    // whether the carte grise is in their own. Same label as the dossier screen.
    ...when(papers.carteGrise, [
      ["Au nom du garage", ouiNon(papers.carteGriseAVotreNom)],
    ]),
    ["Contrôle technique", ouiNon(papers.controleTechnique)],
    ...when(papers.controleTechnique, [
      ["Moins de 6 mois", ouiNon(papers.ctMoins6Mois)],
      ["Résultat obtenu", papers.resultatCT],
    ]),
    ["Certificat de non-gage", ouiNon(papers.certificatNonGage)],
    ["Carnet d'entretien", ouiNon(papers.carnetEntretien)],
    ["Facture d'entretien", ouiNon(papers.factureEntretien)],
    ["Clés de contact", ouiNon(keys.aClesContact)],
    ...when(keys.aClesContact, [
      ["Clé noire", num(keys.cleNoire)],
      ["Clé marron", num(keys.cleMarron)],
      ["Clé rouge", num(keys.cleRouge)],
    ]),
    ["Clé main libre (keyless)", ouiNon(keys.aKeyless)],
    ...when(keys.aKeyless, [
      ["Code", hasKeyless(keys.keyless, "code") ? "Oui" : "Non"],
      ["Clé de secours", hasKeyless(keys.keyless, "secours") ? "Oui" : "Non"],
    ]),
    ["Commentaires véhicule", vehicle.accessoires],
    ["Commentaires complémentaires", pricing.commentaires],
  ]);
}

/** Read from the denormalized `submitter`: a deleted colleague's `users/{uid}`
 *  is removed while their dossiers are kept, so this copy is the only value
 *  guaranteed to still exist. */
function sellerSection(d: RecapDossier): string {
  const { submitter } = d;
  return section("Informations vendeur", [
    ["Entreprise", submitter.companyName],
    ["Nom", submitter.nom],
    ["Prénom", submitter.prenom],
    ["Téléphone", submitter.telephone],
    ["Email", submitter.email],
  ]);
}

/** The status is printed raw: `viewerStatus` exists to hide `a_traiter` from a
 *  b2b reader, and this email only ever goes to the back office. */
function dossierSection(d: RecapDossier, now: Date): string {
  return section("Informations Dossier", [
    ["Date de soumission", d.createdAt === null ? null : submittedAt(d.createdAt)],
    ["Statut", STATUS_LABELS[d.status]],
    ["Prix validé", d.validatedPrice === null ? null : euros(d.validatedPrice)],
    ["Région", REGION_LABELS[d.region]],
    // Two jobs. It tells the reader which version of a moving dossier they are
    // holding — the statut and the prix validé change under them between
    // sends. And it is what keeps each send a distinct message: Gmail threads
    // messages sharing a subject and hides whatever repeats an earlier one
    // behind "Show trimmed content", so without it a resend of an unchanged
    // dossier arrives looking empty. Seconds, not minutes, so two sends in the
    // same minute still differ.
    ["Récapitulatif généré le", generatedAt(now)],
  ]);
}

/**
 * One link per photo, in upload order, labelled "Photo <marque modèle> n°1".
 *
 * Linked, not attached: the recap is a text email, and a dossier can carry a
 * dozen photos that no mailbox wants as attachments. The URLs are the ones
 * `getDownloadURL()` returned at upload — they carry their own token, so the
 * reader needs no session to open one.
 *
 * Every URL handed here is linked as-is. `photos` is client-written, so it is
 * `core.ts` — which knows the dossier's company and our own bucket — that
 * decides which entries are ours; this stays a renderer.
 */
function photosSection(d: RecapDossier): string {
  const label = vehicleLabel(d);
  const links = (d.photos ?? []).map(
    (url, i): Link => [
      ["Photo", label, `n°${i + 1}`].filter(Boolean).join(" "),
      url,
    ],
  );
  return linkSection("Photos du véhicule", links);
}

/** `now` is a parameter, not a `new Date()` inside: this module renders a
 *  document as a function of its inputs, and the caller owns the clock. */
export function recapHtml(d: RecapDossier, now: Date): string {
  return shell(
    recapSubject(d),
    intro(d),
    vehicleSection(d) + sellerSection(d) + dossierSection(d, now) + photosSection(d),
  );
}
