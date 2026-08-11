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
  // Storage
  "storage/unauthorized": "Vous n'avez pas accès à ce fichier.",
  "storage/retry-limit-exceeded": "Connexion impossible. Vérifiez votre réseau.",
};

/** Map a Firestore/Storage error code to French user copy. */
export function mapDataError(code: string): string {
  return MESSAGES[code] ?? "Une erreur est survenue. Veuillez réessayer.";
}

/**
 * Codes meaning "this document is simply no longer reachable" — it was deleted,
 * or access to it was revoked — as opposed to something having gone wrong.
 *
 * Deleting a dossier denies its subdocument listeners rather than emptying
 * them: the rules authorize `mutes` and `messages` by reaching through the
 * dossier document (`get(dossiers/$(id)).data.companyId`), and on an absent
 * document that dereferences null and fails rule evaluation. So every b2b
 * listener open on a dossier the back office deletes ends in `permission-denied`
 * by design. That is an expected end of life for a subscription, not a fault to
 * report.
 */
const EXPECTED_LOSS = new Set(["permission-denied", "not-found"]);

export function isExpectedAccessLoss(code: string): boolean {
  return EXPECTED_LOSS.has(code);
}
