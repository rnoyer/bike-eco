import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  connectAuthEmulator,
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
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://${emulatorHost()}:9099`, {
    disableWarnings: true,
  });
  connectDataEmulators();
}

export { app, db, storage };
