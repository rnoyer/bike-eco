import { createContext, useContext } from "react";

import type { AuthProviderId } from "@/lib/auth/providerEmail";

export interface ProviderProfile {
  prenom: string | null;
  nom: string | null;
  email: string | null;
}

/** The password value seeded on the account step after a third-party sign-in.
 *  The step validator requires both password fields to be non-empty and equal,
 *  and the provider flows have no password to give it — this is never sent
 *  anywhere: `submitInvitedRegistration` omits the password in provider mode. */
export const PROVIDER_PASSWORD_PLACEHOLDER = "provider-auth-placeholder";

/** Lets the shared AccountFields report a successful third-party sign-in to the
 *  enclosing registration screen, so the screen (not ambient auth state) decides
 *  which provider the submission uses. Default is a no-op. */
const ProviderAuthContext = createContext<{
  onProviderProfile: (
    profile: ProviderProfile,
    provider: AuthProviderId,
  ) => Promise<void> | void;
}>({
  onProviderProfile: () => {},
});

export const ProviderAuthProvider = ProviderAuthContext.Provider;
export const useProviderAuthReporter = () => useContext(ProviderAuthContext);
