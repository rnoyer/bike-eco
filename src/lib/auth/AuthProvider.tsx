import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getDoc } from "firebase/firestore";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";

import { auth } from "../../../firebaseConfig";
import { userDoc } from "@/lib/firestore/collections";
import type { AppUser, UserStatus } from "@/lib/firestore/schema";
import { buildSessionUser, parseClaims, type SessionUser } from "./session";

interface AuthState {
  firebaseUser: User | null;
  session: SessionUser | null;
  status: UserStatus | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let generation = 0;
    return onAuthStateChanged(auth, async (user) => {
      const gen = ++generation;
      setFirebaseUser(user);
      if (!user) {
        setSession(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      const [token, snap] = await Promise.all([
        user.getIdTokenResult(true),
        getDoc(userDoc(user.uid)),
      ]);
      // A newer auth event superseded this one while we awaited — drop this result.
      if (gen !== generation) return;
      const claims = parseClaims(token.claims as Record<string, unknown>);
      const profile = (snap.data() as AppUser | undefined) ?? null;
      // No users/{uid} profile doc yet (e.g. mid-registration) → session stays null,
      // which currently routes to sign-in via resolveAuthRoute. The Google/registration
      // slice should instead route a claimless/profileless authenticated user to the
      // pending gate; deferred to that slice, not changed here.
      setSession(profile ? buildSessionUser(user.uid, claims, profile) : null);
      setLoading(false);
    });
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      session,
      status: session?.status ?? null,
      loading,
      signOut: () => fbSignOut(auth),
    }),
    [firebaseUser, session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
