import { connectAuthEmulator, getAuth } from "firebase/auth";

import {
  app,
  connectDataEmulators,
  db,
  emulatorHost,
  storage,
  USE_EMULATORS,
} from "./firebase.core";

// On web, `getAuth` uses browser local storage (IndexedDB) persistence by default.
export const auth = getAuth(app);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://${emulatorHost()}:9099`, {
    disableWarnings: true,
  });
  connectDataEmulators();
}

export { app, db, storage };
