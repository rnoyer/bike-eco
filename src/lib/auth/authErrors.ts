const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email ou mot de passe incorrect.",
  "auth/wrong-password": "Email ou mot de passe incorrect.",
  "auth/user-not-found": "Email ou mot de passe incorrect.",
  "auth/invalid-email": "Saisissez un email valide.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez plus tard.",
  "auth/network-request-failed": "Connexion impossible. Vérifiez votre réseau.",
};

/** Map a Firebase Auth error code to specific, actionable French copy. */
export function mapAuthError(code: string): string {
  return MESSAGES[code] ?? "La connexion a échoué. Veuillez réessayer.";
}

/** Sending a password-reset link fails for its own reasons, and the sign-in copy
 *  ("Email ou mot de passe incorrect.") makes no sense there — an unknown address
 *  is not a wrong password. `auth/user-not-found` never reaches the caller on the
 *  sign-in screen, which reports success either way to avoid revealing whether an
 *  account exists; it is mapped here for the callers that do surface it. */
const RESET_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Saisissez un email valide.",
  "auth/missing-email": "Saisissez votre email.",
  "auth/user-not-found": "Aucun compte n’est associé à cet email.",
  "auth/user-disabled": "Ce compte a été désactivé.",
  "auth/too-many-requests": "Trop de tentatives. Réessayez plus tard.",
  "auth/network-request-failed": "Connexion impossible. Vérifiez votre réseau.",
};

/** Map a Firebase Auth error code raised while sending a password-reset link. */
export function mapPasswordResetError(code: string): string {
  return (
    RESET_MESSAGES[code] ??
    "L’envoi du lien de réinitialisation a échoué. Veuillez réessayer."
  );
}
