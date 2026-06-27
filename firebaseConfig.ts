import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCybLCVKrcssoW9YfyFN4Dl7RrOH2YwIMM",
  authDomain: "bike-eco-641ed.firebaseapp.com",
  projectId: "bike-eco-641ed",
  storageBucket: "bike-eco-641ed.firebasestorage.app",
  messagingSenderId: "671158589631",
  appId: "1:671158589631:web:c0dae01529043978be4e0a",
  measurementId: "G-L56NFYCBCL",
};

// Reuse the existing app instance across Fast Refresh / re-imports.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** App data lives in the named `bike-eco-db` database, not `(default)`. */
export const db = getFirestore(app, "bike-eco-db");

export const storage = getStorage(app);
