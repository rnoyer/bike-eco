import { useAuth } from "@/lib/auth/AuthProvider";

/** Real session, backed by Firebase Auth custom claims + the users/{uid} doc. */
export function useSession() {
  const { session, status, loading, signOut } = useAuth();
  return {
    user: session,
    role: session?.role ?? null,
    status,
    loading,
    signOut,
  };
}
