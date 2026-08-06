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

/**
 * Hosts the Storage emulator can be reached at, all meaning "this machine" from
 * a different vantage point: `10.0.2.2` from the Android emulator, `localhost` /
 * `127.0.0.1` from everywhere else (see `emulatorHost` in `firebase.core.ts`).
 */
const EMULATOR_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?/i;

/**
 * Re-point an emulator download URL at `host`.
 *
 * `getDownloadURL()` against the Storage emulator bakes in whichever host
 * `connectStorageEmulator` was given — and that host is necessarily
 * per-platform. The URL is then persisted verbatim on the dossier (or message),
 * so a dossier filed from the web stores `http://localhost:9199/…`, which on an
 * Android device resolves to the device itself and renders nothing; one filed
 * from Android stores `http://10.0.2.2:9199/…`, which no browser can route.
 *
 * Production URLs point at `firebasestorage.googleapis.com` and are returned
 * untouched, as are the local `file://` uris of a not-yet-sent attachment.
 */
export function rewriteEmulatorHost(url: string, host: string): string {
  return url.replace(
    EMULATOR_ORIGIN,
    (_match, port = "") => `http://${host}${port}`,
  );
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
