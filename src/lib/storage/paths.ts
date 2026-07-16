/**
 * Storage layout for dossier files.
 *
 * Paths are keyed by company so Storage rules can authorize from claims alone:
 * Storage rules can only read Firestore's `(default)` database, and app data
 * lives in the named `bike-eco-db`. Back-office users have no `companyId` claim
 * and are allowed in by role instead.
 *
 * Pure — no `firebaseConfig` import, so it stays unit-testable.
 */

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  heic: "image/heic",
  heif: "image/heif",
  webp: "image/webp",
};

/** Content type for an uploaded photo; the Storage rule matches on this. */
export function mimeForExtension(ext: string): string {
  return MIME_BY_EXTENSION[ext.toLowerCase()] ?? "image/jpeg";
}

/**
 * PhotoPicker keeps only asset URIs, so the extension is all we have to go on.
 * Anything unrecognized is treated as JPEG — the picker's own default.
 */
export function extensionForUri(uri: string): string {
  const ext = /\.([A-Za-z0-9]+)(?:\?|#|$)/.exec(uri)?.[1]?.toLowerCase();
  return ext && ext in MIME_BY_EXTENSION ? ext : "jpg";
}

/** Keep a picked file's name inside one path segment. */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 100);
  return cleaned.length > 0 ? cleaned : "fichier";
}

export function dossierPhotoPath(
  companyId: string,
  dossierId: string,
  index: number,
  ext: string,
): string {
  return `dossiers/${companyId}/${dossierId}/photos/${index}.${ext}`;
}

export function dossierThumbnailPath(
  companyId: string,
  dossierId: string,
): string {
  return `dossiers/${companyId}/${dossierId}/photos/thumb.jpg`;
}

export function messageAttachmentPath(
  companyId: string,
  dossierId: string,
  messageId: string,
  fileName: string,
): string {
  return `dossiers/${companyId}/${dossierId}/messages/${messageId}/${sanitizeFileName(fileName)}`;
}
