// firebase 12's published types omit `getReactNativePersistence` from the
// `firebase/auth` root entry point's type declarations (it only ships under
// the RN-specific `.rn.d.ts` variant, which tsc doesn't select here), even
// though the runtime export exists and works. Re-declare it so `firebaseConfig.ts`
// can use it without a type error. This does not change runtime behavior.
import type { Persistence } from "firebase/auth";

declare module "firebase/auth" {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
