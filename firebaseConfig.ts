import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  connectAuthEmulator,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";

import {
  app,
  connectDataEmulators,
  db,
  emulatorHost,
  storage,
  USE_EMULATORS,
} from "./firebase.core";

// React Native has no browser storage; persist the session via AsyncStorage so
// users stay signed in across reloads. `initializeAuth` (not `getAuth`) is
// required to inject the persistence layer on native.
// initializeAuth throws `auth/already-initialized` if this module is
// re-executed (e.g. Fast Refresh); fall back to the existing instance.
export const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://${emulatorHost()}:9099`, {
    disableWarnings: true,
  });
  connectDataEmulators();
}

export { app, db, storage };
