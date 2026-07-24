/**
 * Idempotently seeds the Auth + Firestore emulators with test identities and
 * data so both roles and the pending-gate are previewable without registration
 * (Slice 4). Run with `npm run seed` while the emulators are running.
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const PROJECT_ID = "bike-eco-43a84";
const DB_ID = "bike-eco-db";

if (!getApps().length) initializeApp({ projectId: PROJECT_ID });
const auth = getAuth();
const db = getFirestore(DB_ID);

type Claims = Record<string, unknown>;

async function upsertUser(
  uid: string,
  email: string,
  password: string,
  claims: Claims,
) {
  try {
    await auth.updateUser(uid, { email, password });
  } catch {
    await auth.createUser({ uid, email, password });
  }
  await auth.setCustomUserClaims(uid, claims);
}

async function main() {
  const now = Timestamp.now();

  await db.doc(`companies/comp_nord`).set({
    siret: "12345678900011",
    name: "Garage du Nord",
    status: "active",
    departement: "75 - Paris",
    region: "NORTH",
    createdBy: "user_b2b_nord",
    createdByName: "Camille Durand",
    validatedAt: now,
    createdAt: now,
  });

  await upsertUser("user_b2b_nord", "b2b@garage-nord.fr", "password123", {
    role: "b2b",
    companyId: "comp_nord",
    status: "active",
  });
  await db.doc(`users/user_b2b_nord`).set({
    role: "b2b", companyId: "comp_nord", region: null,
    nom: "Durand", prenom: "Camille", email: "b2b@garage-nord.fr",
    telephone: "0601020304", departement: "75 - Paris", ville: "Paris",
    status: "active", createdAt: now, updatedAt: now,
  });

  await upsertUser("user_bo", "bo@bike-eco.fr", "password123", {
    role: "backoffice",
    companyId: null,
    region: "NORTH",
    status: "active",
  });
  await db.doc(`users/user_bo`).set({
    role: "backoffice", companyId: null, region: "NORTH",
    nom: "Martin", prenom: "Alex", email: "bo@bike-eco.fr",
    telephone: "0605060708", departement: "45 - Loiret", ville: "Montargis",
    status: "active", createdAt: now, updatedAt: now,
  });

  await upsertUser("user_pending", "pending@garage-nord.fr", "password123", {
    role: "b2b",
    companyId: "comp_nord",
    status: "pending",
  });
  await db.doc(`users/user_pending`).set({
    role: "b2b", companyId: "comp_nord", region: null,
    nom: "Petit", prenom: "Sam", email: "pending@garage-nord.fr",
    telephone: "0611121314", departement: "75 - Paris", ville: "Paris",
    status: "pending", createdAt: now, updatedAt: now,
  });

  for (const [id, region, marque, modele, status] of [
    ["dos_1", "NORTH", "Yamaha", "MT-07", "a_traiter"],
    ["dos_2", "SOUTH", "Kawasaki", "Z650", "en_cours"],
  ] as const) {
    await db.doc(`dossiers/${id}`).set({
      status, region, companyId: "comp_nord", submittedBy: "user_b2b_nord",
      negotiatedPrice: null,
      submitter: { nom: "Durand", prenom: "Camille", companyName: "Garage du Nord" },
      vehicle: {
        electrique: "non", materiel: [], marque, modele,
        cylindree: 689, annee: 2019, kilometrage: 18450, accessoires: "",
      },
      keys: { aClesContact: "oui", cleNoire: 2, cleMarron: 0, cleRouge: 0, aTelecommande: "non", telecommande: null },
      condition: { etat: "Bon état", naturePanne: "" },
      papers: {
        carteGrise: "oui", carteGriseAVotreNom: "oui", controleTechnique: "oui",
        ctMoins6Mois: "oui", resultatCT: "Favorable", certificatNonGage: "oui",
        carnetEntretien: "oui", factureEntretien: "non",
      },
      pricing: { prix: 5000, commentaires: "" },
      photos: [], thumbnailUrl: null,
      createdAt: now, updatedAt: now,
    });
  }

  // A second company so cross-company isolation is checkable by hand.
  await db.doc(`companies/comp_sud`).set({
    siret: "98765432100022",
    name: "Garage du Sud",
    status: "active",
    departement: "13 - Bouches-du-Rhône",
    region: "SOUTH",
    createdBy: "user_b2b_sud",
    createdByName: "Dominique Blanc",
    validatedAt: now,
    createdAt: now,
  });
  await upsertUser("user_b2b_sud", "b2b@garage-sud.fr", "password123", {
    role: "b2b",
    companyId: "comp_sud",
    status: "active",
  });
  await db.doc(`users/user_b2b_sud`).set({
    role: "b2b", companyId: "comp_sud", region: null,
    nom: "Blanc", prenom: "Dominique", email: "b2b@garage-sud.fr",
    telephone: "0621222324", departement: "13 - Bouches-du-Rhône",
    ville: "Marseille", status: "active", createdAt: now, updatedAt: now,
  });
  await db.doc(`dossiers/dos_sud`).set({
    status: "a_traiter", region: "SOUTH", companyId: "comp_sud",
    submittedBy: "user_b2b_sud", negotiatedPrice: null,
    submitter: { nom: "Blanc", prenom: "Dominique", companyName: "Garage du Sud" },
    vehicle: {
      electrique: "non", materiel: [], marque: "Ducati", modele: "Monster",
      cylindree: 937, annee: 2021, kilometrage: 9200, accessoires: "",
    },
    keys: { aClesContact: "oui", cleNoire: 1, cleMarron: 0, cleRouge: 0, aTelecommande: "non", telecommande: null },
    condition: { etat: "Bon état", naturePanne: "" },
    papers: {
      carteGrise: "oui", carteGriseAVotreNom: "oui", controleTechnique: "oui",
      ctMoins6Mois: "oui", resultatCT: "Favorable", certificatNonGage: "oui",
      carnetEntretien: "oui", factureEntretien: "non",
    },
    pricing: { prix: 7000, commentaires: "" },
    photos: [], thumbnailUrl: null,
    createdAt: now, updatedAt: now,
  });

  await db.doc(`dossiers/dos_1/messages/msg_1`).set({
    senderId: "user_b2b_nord",
    senderName: "Camille Durand - Garage du Nord",
    senderRole: "b2b",
    text: "Bonjour, la moto est disponible immédiatement.",
    attachments: [],
    createdAt: now,
  });

  // A pending company for exercising the 4b validation loop.
  await db.doc(`companies/comp_pending`).set({
    siret: "22222222222222",
    name: "Garage Nouveau",
    status: "pending",
    departement: "33 - Gironde",
    region: "SOUTH",
    createdBy: "user_pending_owner",
    createdByName: "Alex Martin",
    validatedAt: null,
    createdAt: now,
  });
  await upsertUser("user_pending_owner", "alex@nouveau.fr", "password123", {
    role: "b2b",
    companyId: "comp_pending",
    status: "pending",
  });
  await db.doc(`users/user_pending_owner`).set({
    role: "b2b", companyId: "comp_pending", region: null,
    nom: "Martin", prenom: "Alex", email: "alex@nouveau.fr",
    telephone: "0655667788", departement: "33 - Gironde", ville: "Bordeaux",
    status: "pending", createdAt: now, updatedAt: now,
  });

  console.log(
    "Seed complete: user_b2b_nord / user_b2b_sud / user_bo / user_pending / user_pending_owner (password123).",
  );
  // The Emulator UI opens on `(default)`, which this project never writes to.
  console.log(`Data is in "${DB_ID}": http://localhost:4000/firestore/${DB_ID}/data`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
