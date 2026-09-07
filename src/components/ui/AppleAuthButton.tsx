/**
 * Android. Metro resolves `.ios.tsx` on iOS and `.web.tsx` on web, so this plain
 * file is Android's — and Sign in with Apple is out of scope there (see
 * `appleSignIn.ts`). Rendering nothing is the whole behaviour; importing
 * `expo-apple-authentication` here would break the Android build.
 */
export default function AppleAuthButton(_props: {
  onPress: () => void;
  disabled?: boolean;
}) {
  return null;
}
