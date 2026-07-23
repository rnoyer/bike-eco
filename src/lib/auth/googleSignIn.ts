import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { auth } from "../../../firebaseConfig";

// webClientId comes from the Firebase console (owner setup); read from env so it
// is not hardcoded. iosClientId is only needed on iOS.
GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});

export async function signInWithGoogle(): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
}> {
  await GoogleSignin.hasPlayServices();
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) throw new Error("Connexion Google annulée.");
  const { idToken, user } = response.data;
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  return { prenom: user.givenName ?? null, nom: user.familyName ?? null, email: user.email ?? null };
}
