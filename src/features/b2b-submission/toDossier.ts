import { isSud } from "@/constants/departments";
import type { SessionUser } from "@/lib/auth/session";
import type {
  Dossier,
  EtatVehicule,
  OuiNon,
  Region,
  ResultatCT,
} from "@/lib/firestore/schema";
import type { B2bSubmissionForm } from "./schema";

/**
 * A dossier as the client writes it. Timestamps are the caller's job: they use
 * `serverTimestamp()`, and importing `firebase/firestore` here would break this
 * module's unit tests (the jest-expo config stubs that package).
 */
export type DossierWrite = Omit<Dossier, "createdAt" | "updatedAt">;

/**
 * Blank/unparseable → null, so "not answered" stays distinct from 0.
 *
 * The emptiness check runs on the *stripped* digits, not the raw input:
 * `Number("")` is 0, so testing the raw value would turn "abc" into year 0
 * rather than "not answered".
 */
function toNumber(value: string | null): number | null {
  if (value == null) return null;
  const digits = value.replace(/[^0-9.-]/g, "");
  if (digits === "") return null;
  const parsed = Number(digits);
  return Number.isNaN(parsed) ? null : parsed;
}

function toOuiNon(value: string | null): OuiNon | null {
  return value === "oui" || value === "non" ? value : null;
}

/**
 * Which Bike-eco centre handles this dealer's département. Unknown codes fall
 * back to NORTH, matching `functions/src/regions.ts` for the B2C funnel.
 */
export function regionForDepartement(departement: string): Region {
  return isSud(departement) ? "SOUTH" : "NORTH";
}

/**
 * Map the "Vendre une moto" funnel onto a dossier document.
 *
 * Identity comes from the session, never the form: the create rule pins
 * `companyId`/`submittedBy` to the caller's claims, so anything else is rejected.
 */
export function toDossierPayload(
  values: B2bSubmissionForm,
  session: SessionUser,
  company: { id: string; name: string; departement: string },
  photos: { urls: string[]; thumbnailUrl: string | null },
): DossierWrite {
  return {
    status: "a_traiter",
    region: regionForDepartement(company.departement),
    companyId: company.id,
    submittedBy: session.id,
    // Set to submittedBy at creation (see the field's doc comment on Dossier);
    // the back office becomes the writer on every subsequent management update.
    updatedBy: session.id,
    validatedPrice: null,
    submitter: {
      nom: session.nom,
      prenom: session.prenom,
      companyName: company.name,
      email: session.email,
      telephone: session.telephone,
    },
    vehicle: {
      stock: toOuiNon(values.stock),
      immatriculation: values.immatriculation.trim(),
      electrique: toOuiNon(values.electrique) ?? "non",
      materiel: values.materiel,
      marque: values.marque.trim(),
      // The B2B funnel merges "Modèle et Cylindrée" into one field, so the
      // dossier's separate `cylindree` has no source here.
      modele: values.modele.trim(),
      cylindree: null,
      annee: toNumber(values.annee),
      kilometrage: toNumber(values.kilometrage),
      accessoires: values.accessoires.trim(),
    },
    keys: {
      aClesContact: toOuiNon(values.aClesContact),
      cleNoire: toNumber(values.cleNoire),
      cleMarron: toNumber(values.cleMarron),
      cleRouge: toNumber(values.cleRouge),
      aKeyless: toOuiNon(values.aKeyless),
      keyless: values.keyless,
    },
    condition: {
      etat: (values.etat as EtatVehicule | null) ?? null,
      naturePanne: values.naturePanne.trim(),
    },
    papers: {
      carteGrise: toOuiNon(values.carteGrise),
      carteGriseAVotreNom: toOuiNon(values.carteGriseAVotreNom),
      controleTechnique: toOuiNon(values.controleTechnique),
      ctMoins6Mois: toOuiNon(values.ctMoins6Mois),
      resultatCT: (values.resultatCT as ResultatCT | null) ?? null,
      certificatNonGage: toOuiNon(values.certificatNonGage),
      carnetEntretien: toOuiNon(values.carnetEntretien),
      factureEntretien: toOuiNon(values.factureEntretien),
    },
    pricing: {
      prix: toNumber(values.prix),
      commentaires: values.commentaires.trim(),
    },
    photos: photos.urls,
    thumbnailUrl: photos.thumbnailUrl,
  };
}
