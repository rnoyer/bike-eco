/**
 * Reading a Firebase Storage *download URL*.
 *
 * Both places that consume a client-supplied file URL need this: message
 * attachments (validated before they are persisted) and the dossier recap
 * email (which turns `dossiers/{id}.photos` into anchors — and those URLs are
 * written by the dealer's own client, so an unchecked one would let a signed-in
 * dealer put an arbitrary link in a mail sent to the back office).
 */

// Hosts that can serve a legitimate download URL: the production Firebase
// Storage host, plus loopback for the local Storage emulator (dev). All three
// loopback spellings appear in stored URLs — `10.0.2.2` from the Android
// emulator, `localhost` / `127.0.0.1` from everywhere else (see `emulatorHost`
// in `firebase.core.ts`).
const STORAGE_HOSTS = new Set([
  "firebasestorage.googleapis.com",
  "localhost",
  "127.0.0.1",
  "10.0.2.2",
]);

/** `https://<host>/v0/b/<bucket>/o/<percent-encoded path>?alt=media&token=…` */
const DOWNLOAD_PATH = /^\/v0\/b\/([^/]+)\/o\/(.+)$/;

export interface StorageObject {
  bucket: string;
  /** Percent-encoded, exactly as it appears in the URL: `a%2Fb%2Fc.jpg`. */
  path: string;
}

/**
 * The bucket and object a Storage download URL points at, or `null` when the
 * value is not one.
 *
 * The URL is parsed rather than substring-matched, the host must be known, and
 * bucket and path come from `URL.pathname` — which excludes the query string,
 * so neither can be smuggled in through `?...`.
 */
export function parseStorageDownloadUrl(url: string): StorageObject | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (!STORAGE_HOSTS.has(parsed.hostname)) return null;
  const match = DOWNLOAD_PATH.exec(parsed.pathname);
  return match ? { bucket: match[1], path: match[2] } : null;
}

/**
 * True when `url` is a download URL for a photo of this very dossier.
 *
 * The host alone is not enough: anyone can create a Firebase project, so
 * `firebasestorage.googleapis.com/v0/b/<their-bucket>/o/phish.html` is a
 * perfectly well-formed download URL on our host. The bucket and the object's
 * own prefix are what tie it to this dossier.
 *
 * `bucket` is `null` only when the runtime could not tell us its own bucket
 * name; the check then falls back to host + path rather than dropping every
 * photo of every recap over a configuration detail.
 */
export function isDossierPhotoUrl(
  url: string,
  scope: { bucket: string | null; companyId: string; dossierId: string },
): boolean {
  const object = parseStorageDownloadUrl(url);
  if (!object) return false;
  if (scope.bucket !== null && object.bucket !== scope.bucket) return false;
  // companyId/dossierId are alphanumeric ids, so only the `/` separators are
  // encoded. `dossierPhotoPath` (src/lib/storage/paths.ts) writes photos and
  // the thumbnail here and nothing else does.
  return object.path.startsWith(
    `dossiers%2F${scope.companyId}%2F${scope.dossierId}%2Fphotos%2F`,
  );
}
