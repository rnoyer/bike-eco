import type { AppUser } from "@/lib/firestore/schema";
import { type WithId } from "./fixtures";
import { useSession } from "./useSession";

export function useAccount(): { data: WithId<AppUser>; loading: boolean } {
  const { user } = useSession();
  return { data: user, loading: false };
}
