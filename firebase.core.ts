import { Platform } from "react-native";
import { getApp, getApps, initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyChXe-cQ1N3jMXI88vKMDlZj22Ep-PKjF4",
  authDomain: "bike-eco-43a84.firebaseapp.com",
  projectId: "bike-eco-43a84",
  storageBucket: "bike-eco-43a84.firebasestorage.app",
  messagingSenderId: "585450098034",
  appId: "1:585450098034:web:a460a8347bb5251d18a1eb",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/** App data lives in the named `bike-eco-db` database, not `(default)`. */
export const db = getFirestore(app, "bike-eco-db");
export const storage = getStorage(app);

/** Dev opt-in: point every SDK at the local emulators. */
export const USE_EMULATORS =
  __DEV__ && process.env.EXPO_PUBLIC_USE_EMULATORS === "1";

/**
 * The Android emulator's `localhost` is its own loopback; `10.0.2.2` is its
 * alias for the host machine's 127.0.0.1. iOS sim and web share the host loopback.
 */
export function emulatorHost(os: string = Platform.OS): string {
  return os === "android" ? "10.0.2.2" : "localhost";
}

let connected = false;
/** Idempotently connect Firestore + Storage to the emulators (call once). */
export function connectDataEmulators() {
  if (!USE_EMULATORS || connected) return;
  connected = true;
  const host = emulatorHost();
  connectFirestoreEmulator(db, host, 8080);
  connectStorageEmulator(storage, host, 9199);
}
