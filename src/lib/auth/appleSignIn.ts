/**
 * Android. Metro resolves `.ios.ts` on iOS and `.web.ts` on web, so this plain
 * file is what Android gets — which is why Apple needs a three-file split where
 * Google needs only two: `expo-apple-authentication` is iOS-only, and Google's
 * native module is not. Nothing native may be imported here.
 *
 * Sign in with Apple on Android would need a browser round-trip against the
 * Apple Services ID; it is deliberately out of scope. No Apple button is
 * rendered on Android, so `signInWithApple` should be unreachable — it throws
 * rather than failing silently if that ever stops being true.
 */

export async function isAppleSignInAvailable(): Promise<boolean> {
  return false;
}

export async function signInWithApple(_opts?: {
  expectedEmail?: string;
}): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
  isNewUser: boolean;
}> {
  throw new Error("La connexion Apple n’est pas disponible sur cet appareil.");
}
