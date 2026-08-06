import { emulatorHost, USE_EMULATORS } from "../../../firebase.core";
import { rewriteEmulatorHost } from "./paths";

/**
 * Make a stored file URL loadable on *this* platform.
 *
 * Apply it wherever a persisted Storage URL becomes an image source or an
 * opened link. Outside the emulators it is the identity function — see
 * `rewriteEmulatorHost` for why it is needed inside them.
 */
export function storageUrl<T extends string | null | undefined>(url: T): T {
  if (!url || !USE_EMULATORS) return url;
  return rewriteEmulatorHost(url, emulatorHost()) as T;
}
