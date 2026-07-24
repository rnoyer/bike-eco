import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../../../firebaseConfig";

export async function signInWithGoogle(): Promise<{
  prenom: string | null;
  nom: string | null;
  email: string | null;
}> {
  const result = await signInWithPopup(auth, new GoogleAuthProvider());
  // Web only gives a single displayName; split best-effort into prénom / nom.
  const parts = (result.user.displayName ?? "").trim().split(/\s+/);
  return {
    prenom: parts[0] || null,
    nom: parts.length > 1 ? parts.slice(1).join(" ") : null,
    email: result.user.email ?? null,
  };
}
