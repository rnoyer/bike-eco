import { section, shell, type Row } from "../emailHtml";
import {
  euros,
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
 * The subset of a `dossiers/{id}` document the recap prints — which is all of
 * it bar the photos and the routing fields.
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
    aTelecommande: OuiNon | null;
    telecommande: number | null;
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
    ["Année", num(vehicle.annee)],
    [
      "Kilométrage",
      vehicle.kilometrage === null ? null : kilometres(vehicle.kilometrage),
    ],
    ["Électrique", ouiNon(vehicle.electrique)],
    ...when(vehicle.electrique, [
      ["Batterie présente", hasMateriel(vehicle.materiel, "batterie") ? "Oui" : "Non"],
      ["Chargeur présent", hasMateriel(vehicle.materiel, "chargeur") ? "Oui" : "Non"],
    ]),
    ["État", condition.etat],
    // Free text, and only ever filled for this one état.
    ["Nature de la panne", condition.etat === "En Panne" ? condition.naturePanne : null],
    ["Carte grise", ouiNon(papers.carteGrise)],
    ...when(papers.carteGrise, [["À votre nom", ouiNon(papers.carteGriseAVotreNom)]]),
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
    ["Télécommande ou Bip", ouiNon(keys.aTelecommande)],
    ...when(keys.aTelecommande, [["Nombre", num(keys.telecommande)]]),
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
function dossierSection(d: RecapDossier): string {
  return section("Informations Dossier", [
    ["Date de soumission", d.createdAt === null ? null : submittedAt(d.createdAt)],
    ["Statut", STATUS_LABELS[d.status]],
    ["Prix validé", d.validatedPrice === null ? null : euros(d.validatedPrice)],
    ["Région", REGION_LABELS[d.region]],
  ]);
}

export function recapHtml(d: RecapDossier): string {
  return shell(
    recapSubject(d),
    intro(d),
    vehicleSection(d) + sellerSection(d) + dossierSection(d),
  );
}
