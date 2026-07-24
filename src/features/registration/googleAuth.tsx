import { createContext, useContext } from "react";

export interface GoogleProfile {
  prenom: string | null;
  nom: string | null;
  email: string | null;
}

/** Lets the shared AccountFields report a successful Google sign-in to the
 *  enclosing registration screen, so the screen (not ambient auth state) decides
 *  whether the submission is Google-mode. Default is a no-op. */
const GoogleAuthContext = createContext<{
  onGoogleProfile: (p: GoogleProfile) => Promise<void> | void;
}>({
  onGoogleProfile: () => {},
});

export const GoogleAuthProvider = GoogleAuthContext.Provider;
export const useGoogleAuthReporter = () => useContext(GoogleAuthContext);
