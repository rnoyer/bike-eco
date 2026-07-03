import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyChXe-cQ1N3jMXI88vKMDlZj22Ep-PKjF4",
  authDomain: "bike-eco-43a84.firebaseapp.com",
  projectId: "bike-eco-43a84",
  storageBucket: "bike-eco-43a84.firebasestorage.app",
  messagingSenderId: "585450098034",
  appId: "1:585450098034:web:a460a8347bb5251d18a1eb"
};

// Reuse the existing app instance across Fast Refresh / re-imports.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** App data lives in the named `bike-eco-db` database, not `(default)`. */
export const db = getFirestore(app, "bike-eco-db");

export const storage = getStorage(app);
