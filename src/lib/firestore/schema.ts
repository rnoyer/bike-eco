import type { Timestamp } from "firebase/firestore";

/**
 * The Firestore data model for Bike-eco, expressed as read-side types
 * (timestamps are `Timestamp`, as returned by reads). Writes may substitute
 * `serverTimestamp()` for timestamp fields — see the converters layer.
 *
 * Collections:
 *   companies/{companyId}
 *   users/{uid}
 *   invitations/{invitationId}
 *   dossiers/{dossierId}                    (B2B only — B2C is email-only)
 *   dossiers/{dossierId}/messages/{messageId}
 */

// ─── shared enums ────────────────────────────────────────────────────────────

export type OuiNon = "oui" | "non";
export type Region = "NORTH" | "SOUTH";
export type UserRole = "b2b" | "backoffice";

// Decline hard-deletes the applicant (frees the SIRET), so a company only ever
// exists in `pending` or `active` — there is no persisted `rejected` state.
export const COMPANY_STATUSES = ["pending", "active"] as const;
export type CompanyStatus = (typeof COMPANY_STATUSES)[number];

export const USER_STATUSES = ["pending", "active"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// An invitation only ever exists in `pending` state: acceptance and expiry
// both delete the document (see functions/src/registration) rather than
// transitioning its status.
export const INVITATION_STATUSES = ["pending"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/** `a_traiter` = new, `en_cours` = ongoing, `cloture` = closed. */
export const DOSSIER_STATUSES = ["a_traiter", "en_cours", "cloture"] as const;
export type DossierStatus = (typeof DOSSIER_STATUSES)[number];

export const ETATS_VEHICULE = [
  "Bon état",
  "En Panne",
  "Fort kilométrage",
  "Refus au Contrôle Technique",
  "Mauvais Etat",
  "Accidenté",
] as const;
export type EtatVehicule = (typeof ETATS_VEHICULE)[number];

export type ResultatCT = "Favorable" | "Défavorable";
export type AttachmentType = "image" | "pdf";

// ─── companies ───────────────────────────────────────────────────────────────

/**
 * Document id: `<siret>-<6 alphanumerics>` (`functions/src/registration/companyId.ts`),
 * readable in the console. Companies created before that change keep their
 * auto-generated id — nothing parses the id, so both forms coexist.
 */
export interface Company {
  siret: string; // 14 digits, immutable
  name: string;
  status: CompanyStatus; // manual validation by the Bike-eco team
  departement: string; // "33 - Gironde" — captured at registration
  ville: string; // company city
  region: Region; // derived from departement; drives back-office routing
  createdBy: string; // uid of the first registrant
  createdByName: string; // denormalized "prénom nom" for the company card subtitle
  validatedAt: Timestamp | null; // set on approve; null while pending
  createdAt: Timestamp;
}

// ─── users ───────────────────────────────────────────────────────────────────

/** Mirrors the Auth custom claims; `role`/`companyId`/`status` are server-set. */
export interface AppUser {
  role: UserRole;
  companyId: string | null; // b2b only
  nom: string;
  prenom: string;
  email: string; // PII — owner + team read only
  telephone: string; // PII
  status: UserStatus; // pending until the company is validated
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── invitations ─────────────────────────────────────────────────────────────

export interface Invitation {
  email: string;
  companyId: string;
  invitedBy: string; // uid
  tokenHash: string; // store a hash, never the raw token
  status: InvitationStatus;
  expiresAt: Timestamp; // one-time, time-limited
  createdAt: Timestamp;
}

// ─── dossiers ────────────────────────────────────────────────────────────────

/** Denormalized identity for cards/chat (avoids extra reads). */
export interface DossierSubmitter {
  nom: string;
  prenom: string;
  companyName: string;
  // Contact PII, copied from the submitter's profile at creation. Denormalized
  // because `users/{uid}` is readable only by its owner and the back-office —
  // a B2B teammate viewing a colleague's dossier could not read it live.
  email: string;
  telephone: string;
}

export interface DossierVehicle {
  electrique: OuiNon;
  materiel: string[]; // e.g. "J'ai la batterie", "J'ai le chargeur"
  marque: string;
  modele: string; // B2B merges "Modèle et Cylindrée" here
  cylindree: number | null;
  annee: number | null;
  kilometrage: number | null;
  accessoires: string;
}

export interface DossierKeys {
  aClesContact: OuiNon | null;
  cleNoire: number | null;
  cleMarron: number | null;
  cleRouge: number | null;
  aTelecommande: OuiNon | null;
  telecommande: number | null;
}

export interface DossierCondition {
  etat: EtatVehicule | null;
  naturePanne: string;
}

export interface DossierPapers {
  carteGrise: OuiNon | null;
  carteGriseAVotreNom: OuiNon | null;
  controleTechnique: OuiNon | null;
  ctMoins6Mois: OuiNon | null;
  resultatCT: ResultatCT | null;
  certificatNonGage: OuiNon | null;
  carnetEntretien: OuiNon | null;
  factureEntretien: OuiNon | null;
}

export interface DossierPricing {
  prix: number | null;
  commentaires: string;
}

export interface Dossier {
  status: DossierStatus;
  region: Region; // initially derived from the submitter's company departement; reassignable by the back-office (page-dossier-management)
  companyId: string;
  submittedBy: string; // uid
  negotiatedPrice: number | null; // back-office deal outcome (page-dossier-management)
  submitter: DossierSubmitter;
  vehicle: DossierVehicle;
  keys: DossierKeys;
  condition: DossierCondition;
  papers: DossierPapers;
  pricing: DossierPricing;
  photos: string[]; // Storage download URLs
  thumbnailUrl: string | null; // low-res first photo
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ─── messages (subcollection of dossiers) ────────────────────────────────────

export interface MessageAttachment {
  type: AttachmentType;
  url: string; // Storage download URL
  name: string;
  size: number; // bytes
}

export interface Message {
  senderId: string; // uid
  senderName: string; // server-derived "[name] - [company]" / "[name] - Bike-eco" (stamped by the sendMessage callable)
  senderRole: UserRole;
  text: string;
  attachments: MessageAttachment[];
  createdAt: Timestamp;
}
