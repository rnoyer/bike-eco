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
    createdBy: "user_b2b",
    createdAt: now,
  });

  await upsertUser("user_b2b", "b2b@garage-nord.fr", "password123", {
    role: "b2b",
    companyId: "comp_nord",
    status: "active",
  });
  await db.doc(`users/user_b2b`).set({
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
      status, region, companyId: "comp_nord", submittedBy: "user_b2b",
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

  console.log("Seed complete: user_b2b / user_bo / user_pending (password123).");
  // The Emulator UI opens on `(default)`, which this project never writes to.
  console.log(`Data is in "${DB_ID}": http://localhost:4000/firestore/${DB_ID}/data`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
