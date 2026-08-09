import { useAuth } from "@/lib/auth/AuthProvider";
import { userDoc } from "@/lib/firestore/collections";
import type { AppUser } from "@/lib/firestore/schema";
import { useLiveDoc } from "./useLive";

/** Live single user profile. Stays loading for an empty uid (route params
 *  resolve late), exactly like `useDossier`. */
export function useUser(uid: string) {
  const { session } = useAuth();
  return useLiveDoc<AppUser>(session && uid ? uid : "", () => userDoc(uid));
}
