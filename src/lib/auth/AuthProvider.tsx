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
import { getDoc, onSnapshot } from "firebase/firestore";
import {
  onAuthStateChanged,
  signOut as fbSignOut,
  type User,
} from "firebase/auth";

import { auth } from "../../../firebaseConfig";
import { userDoc } from "@/lib/firestore/collections";
import type { AppUser, UserStatus } from "@/lib/firestore/schema";
import { unregisterPushToken } from "@/lib/notifications/pushRegistration";
import {
  buildSessionUser,
  isAccountDeleted,
  isNewlyActivated,
  parseClaims,
  type SessionUser,
} from "./session";

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

  // Reads `auth.currentUser` rather than the `firebaseUser` state so the
  // identity is stable: the deleted-account watch below depends on it, and a
  // callback that changed on every auth event would resubscribe that listener.
  const signOut = useCallback(async () => {
    // Before `fbSignOut`: once the credential is gone the owner-only rule
    // rejects the delete, and this device would keep receiving pushes for an
    // account that is no longer signed in on it.
    const uid = auth.currentUser?.uid;
    if (uid) await unregisterPushToken(uid);
    await fbSignOut(auth);
  }, []);

  // Deleted-account watch. When someone *else* deletes this account (a company
  // admin via `deleteColleague`, the back office deleting the whole company, or
  // an ops script), the server drops the Auth user — but that does not
  // invalidate the ID token this device already holds. Every rule authorizes on
  // that token's claims alone, so without this the deleted user keeps reading
  // and writing everything, dossier submission included, until the SDK's own
  // proactive token refresh fails, up to an hour later. That still-valid token
  // is exactly what keeps this listener authorized long enough to receive the
  // delete event, so the sign-out lands within a snapshot's latency.
  //
  // Keyed on the session's uid, not on `firebaseUser`, and so armed only once a
  // profile has actually been read: an authenticated user with *no* profile doc
  // is the normal mid-registration state (Google sign-in happens before the
  // callable creates `users/{uid}`), and signing that user out would break
  // registration instead of fixing anything.
  const uid = session?.id;
  // Read inside the snapshot callback rather than closed over, so the listener
  // is not torn down and re-armed every time the session changes.
  const statusRef = useRef<UserStatus | null>(null);
  useEffect(() => {
    statusRef.current = session?.status ?? null;
  }, [session?.status]);
  // The activation refresh is async and a burst of snapshots would each start
  // one; `loadSession`'s generation counter makes the extras harmless, but they
  // are still a forced token refresh and a profile read apiece.
  const refreshingRef = useRef(false);
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      userDoc(uid),
      (snap) => {
        if (
          isAccountDeleted({
            exists: snap.exists(),
            fromCache: snap.metadata.fromCache,
          })
        ) {
          // The profile is already gone, so the push-token delete inside
          // `signOut` is a no-op — it is the FCM listener teardown that matters.
          void signOut();
          return;
        }
        // Activation watch, riding the same listener. `approveCompany` sets the
        // claim and the profile field together, but only the profile change is
        // pushed to this device — claims are read from the ID token, which
        // `onAuthStateChanged` does not re-fire for. Without this the approved
        // user sits on the pending screen until they relaunch the app, and
        // `usePushRegistration`, which needs a session to register under, waits
        // just as long.
        if (
          isNewlyActivated({
            profileStatus: (snap.data() as AppUser | undefined)?.status,
            sessionStatus: statusRef.current,
          }) &&
          !refreshingRef.current
        ) {
          refreshingRef.current = true;
          void refreshSession().finally(() => {
            refreshingRef.current = false;
          });
        }
      },
      // Not a sign-out trigger: the owner-read rule cannot deny a live
      // credential, so an error here is transport or an already-expired token,
      // and the SDK ends that session on its own.
      (err) => console.warn("[auth] account watch failed", err),
    );
    // `signOut` and `refreshSession` are both `useCallback([])`, so this arms
    // once per uid — adding them cannot resubscribe the listener.
  }, [uid, signOut, refreshSession]);

  const value = useMemo<AuthState>(
    () => ({
      firebaseUser,
      session,
      status: session?.status ?? null,
      loading,
      initializing,
      signOut,
      refreshSession,
    }),
    [firebaseUser, session, loading, initializing, signOut, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
