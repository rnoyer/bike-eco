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
