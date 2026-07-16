/**
 * Firestore/Storage error codes → specific, actionable French copy.
 * Mirrors `@/lib/auth/authErrors`. Pure: no `firebaseConfig` import, so it stays
 * testable under the jest-expo config (which stubs `firebase/firestore`).
 */
const MESSAGES: Record<string, string> = {
  // Firestore
  "permission-denied": "Vous n'avez pas accès à ce dossier.",
  "not-found": "Ce dossier n'existe plus.",
  unavailable: "Connexion impossible. Vérifiez votre réseau.",
  cancelled: "Opération annulée.",
  // Storage
  "storage/unauthorized": "Vous n'avez pas accès à ce fichier.",
  "storage/retry-limit-exceeded": "Connexion impossible. Vérifiez votre réseau.",
  "storage/canceled": "Envoi annulé.",
  "storage/quota-exceeded": "Espace de stockage insuffisant.",
};

/** Map a Firestore/Storage error code to French user copy. */
export function mapDataError(code: string): string {
  return MESSAGES[code] ?? "Une erreur est survenue. Veuillez réessayer.";
}
