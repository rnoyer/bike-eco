import { Timestamp } from "firebase/firestore";
import type {
  AppUser,
  Company,
  Dossier,
  Message,
} from "@/lib/firestore/schema";
import type { WithId } from "@/lib/firestore/collections";

export type { WithId } from "@/lib/firestore/collections";

const ts = (iso: string) => Timestamp.fromDate(new Date(iso));
const PHOTO = (seed: string) => `https://picsum.photos/seed/${seed}/800/600`;
const THUMB = (seed: string) => `https://picsum.photos/seed/${seed}/200/150`;

export const MOCK_COMPANIES: WithId<Company>[] = [
  {
    id: "comp_nord",
    siret: "12345678900011",
    name: "Garage du Nord",
    status: "active",
    createdBy: "user_b2b",
    createdAt: ts("2026-05-01"),
  },
];

export const MOCK_USERS: WithId<AppUser>[] = [
  {
    id: "user_b2b",
    role: "b2b",
    companyId: "comp_nord",
    region: null,
    nom: "Durand",
    prenom: "Camille",
    email: "camille@garage-nord.fr",
    telephone: "0601020304",
    departement: "75 - Paris",
    ville: "Paris",
    status: "active",
    createdAt: ts("2026-05-01"),
    updatedAt: ts("2026-05-01"),
  },
  {
    id: "user_bo",
    role: "backoffice",
    companyId: null,
    region: "NORTH",
    nom: "Martin",
    prenom: "Alex",
    email: "alex@bike-eco.fr",
    telephone: "0605060708",
    departement: "45 - Loiret",
    ville: "Montargis",
    status: "active",
    createdAt: ts("2026-04-01"),
    updatedAt: ts("2026-04-01"),
  },
];

const baseVehicle = {
  electrique: "non" as const,
  materiel: [] as string[],
  marque: "Yamaha",
  modele: "MT-07",
  cylindree: 689,
  annee: 2019,
  kilometrage: 18450,
  accessoires: "Sabot moteur, top-case",
};

const emptyKeys = {
  aClesContact: "oui" as const,
  cleNoire: 2,
  cleMarron: 0,
  cleRouge: 0,
  aTelecommande: "non" as const,
  telecommande: null,
};

const okPapers = {
  carteGrise: "oui" as const,
  carteGriseAVotreNom: "oui" as const,
  controleTechnique: "oui" as const,
  ctMoins6Mois: "oui" as const,
  resultatCT: "Favorable" as const,
  certificatNonGage: "oui" as const,
  carnetEntretien: "oui" as const,
  factureEntretien: "non" as const,
};

function makeDossier(
  id: string,
  status: Dossier["status"],
  region: Dossier["region"],
  marque: string,
  modele: string
): WithId<Dossier> {
  return {
    id,
    status,
    region,
    companyId: "comp_nord",
    submittedBy: "user_b2b",
    negotiatedPrice: status === "cloture" ? 4200 : null,
    submitter: { nom: "Durand", prenom: "Camille", companyName: "Garage du Nord" },
    vehicle: { ...baseVehicle, marque, modele },
    keys: emptyKeys,
    condition: { etat: "Bon état", naturePanne: "" },
    papers: okPapers,
    pricing: { prix: 5000, commentaires: "Première main, entretien suivi." },
    photos: [PHOTO(id + "a"), PHOTO(id + "b"), PHOTO(id + "c")],
    thumbnailUrl: THUMB(id + "a"),
    createdAt: ts("2026-06-20"),
    updatedAt: ts("2026-06-21"),
  };
}

export const MOCK_DOSSIERS: WithId<Dossier>[] = [
  makeDossier("dos_1", "a_traiter", "NORTH", "Yamaha", "MT-07"),
  makeDossier("dos_2", "en_cours", "NORTH", "Honda", "CB500F"),
  makeDossier("dos_3", "cloture", "SOUTH", "Kawasaki", "Z650"),
  makeDossier("dos_4", "a_traiter", "SOUTH", "BMW", "G310R"),
];

export function messagesFor(dossierId: string): Message[] {
  return [
    {
      senderId: "user_b2b",
      senderName: "Camille Durand - Garage du Nord",
      senderRole: "b2b",
      text: "Bonjour, la moto est disponible immédiatement.",
      attachments: [],
      createdAt: ts("2026-06-22T09:00:00"),
    },
    {
      senderId: "user_bo",
      senderName: "Alex Martin - Bike-eco",
      senderRole: "backoffice",
      text: "Merci, nous revenons vers vous avec une offre.",
      attachments: [
        { type: "pdf", url: PHOTO(dossierId), name: "offre.pdf", size: 84213 },
      ],
      createdAt: ts("2026-06-22T11:30:00"),
    },
  ];
}
