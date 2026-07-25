import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /** True until auth resolves for the first time; false forever after. */
  initializing: boolean;
  signOut: () => Promise<void>;
  /**
   * Re-reads the (force-refreshed) token + profile and rebuilds the session.
   * Needed after flows where claims are set server-side *after* sign-in
   * (e.g. Google registration), since `onAuthStateChanged` does not re-fire
   * when custom claims change.
   */
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializing, setInitializing] = useState(true);
  // Shared across both the auth-state listener and manual refreshSession()
  // calls: a later loadSession() invocation invalidates an in-flight earlier
  // one, so a slow/stale read never clobbers a fresher result.
  const generationRef = useRef(0);

  // Force-refreshes the token, re-parses claims, reloads the users/{uid}
  // profile doc, and rebuilds the session. Called from the auth-state
  // listener on every sign-in, and manually via refreshSession() after flows
  // (e.g. Google registration) where server-set claims land after sign-in.
  async function loadSession(user: User) {
    const gen = ++generationRef.current;
    setFirebaseUser(user);
    setLoading(true);
    try {
      const [token, snap] = await Promise.all([
        user.getIdTokenResult(true),
        getDoc(userDoc(user.uid)),
      ]);
      // A newer auth event superseded this one while we awaited — drop this result.
      if (gen !== generationRef.current) return;
      const claims = parseClaims(token.claims as Record<string, unknown>);
      const profile = (snap.data() as AppUser | undefined) ?? null;
      // No users/{uid} profile doc yet (e.g. mid-registration) → session stays null,
      // which currently routes to sign-in via resolveAuthRoute. The Google/registration
      // slice should instead route a claimless/profileless authenticated user to the
      // pending gate; deferred to that slice, not changed here.
      setSession(profile ? buildSessionUser(user.uid, claims, profile) : null);
    } catch (err) {
      // Without this the rejection escapes into the async onAuthStateChanged
      // callback, `loading` never clears, and AuthGate's `if (loading) return`
      // silently kills every redirect for the rest of the process — a tap on
      // sign-in would appear to do nothing at all. Fail to a null session so the
      // guard sends the user back to sign-in instead of stranding them.
      if (gen !== generationRef.current) return;
      console.warn("[auth] session load failed", err);
      setSession(null);
    } finally {
      // Only the newest call owns the flags; a superseded one must not clear
      // them out from under the call that replaced it.
      if (gen === generationRef.current) {
        setLoading(false);
        setInitializing(false);
      }
    }
  }

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        // Invalidate any in-flight loadSession() so its result is dropped.
        generationRef.current++;
        setFirebaseUser(null);
        setSession(null);
        setLoading(false);
        setInitializing(false);
        return;
      }
      await loadSession(user);
    });
  }, []);

  const refreshSession = useCallback(async () => {
    if (auth.currentUser) await loadSession(auth.currentUser);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      session,
      status: session?.status ?? null,
      loading,
      initializing,
      signOut: () => fbSignOut(auth),
      refreshSession,
    }),
    [firebaseUser, session, loading, initializing, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
