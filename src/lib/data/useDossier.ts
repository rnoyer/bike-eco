import { useAuth } from "@/lib/auth/AuthProvider";
import { dossierDoc } from "@/lib/firestore/collections";
import type { Dossier } from "@/lib/firestore/schema";
import { useLiveDoc } from "./useLive";

/** Live single dossier. Stays loading for an empty id (route params resolve late). */
export function useDossier(id: string) {
  const { session } = useAuth();
  return useLiveDoc<Dossier>(session && id ? id : "", () => dossierDoc(id));
}
