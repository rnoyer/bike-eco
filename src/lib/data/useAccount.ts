import { useAuth } from "@/lib/auth/AuthProvider";
import type { SessionUser } from "@/lib/auth/session";

export function useAccount(): { data: SessionUser | null; loading: boolean } {
  const { session, loading } = useAuth();
  return { data: session, loading };
}
