import SignInFields from "@/components/form/SignInFields";
import Button from "@/components/ui/Button";
import PhotoBackground from "@/components/ui/PhotoBackground";
import ThirdPartyAuthButtons from "@/components/ui/ThirdPartyAuthButtons";
import {
  frenchAuthMessage,
  mapPasswordResetError,
} from "@/lib/auth/authErrors";
import { signInWithGoogle } from "@/lib/auth/googleSignIn";
import { mapDataError } from "@/lib/data/dataErrors";
import { userDoc } from "@/lib/firestore/collections";
import {
  WRITE_TIMEOUT_MS,
  writeWithTimeout,
} from "@/lib/firestore/writeWithTimeout";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";
import { tokens } from "@/theme/tokens";
import { useRouter } from "expo-router";
import {
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getDoc } from "firebase/firestore";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../../firebaseConfig";

/** Shown whether or not the address has an account — see `handleForgot`. */
const RESET_SENT =
  "Si un compte existe pour cet email, un lien de réinitialisation vient d’être envoyé. Vérifiez votre boîte de réception.";

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // One error line and one notice line are shared by all three actions, so
  // they stay screen state; each action owns only its own pending flag.
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setNotice(null);
  };

  const signingIn = useAsyncAction(
    async (email: string, password: string) => {
      clearMessages();
      await signInWithEmailAndPassword(auth, email, password);
      // The root AuthGate redirects on the resulting auth-state change.
    },
    { mapError: frenchAuthMessage, onError: setError },
  );

  const googleSigningIn = useAsyncAction(
    async () => {
      clearMessages();
      const { isNewUser } = await signInWithGoogle();
      const user = auth.currentUser;
      if (!user) {
        setError("La connexion a échoué. Veuillez réessayer.");
        return;
      }
      // Sign-in is not registration: a Google identity with no users/{uid}
      // profile has never been through the funnel, and would otherwise sit
      // authenticated-but-sessionless on this screen (see AuthProvider).
      let registered: boolean;
      try {
        // Firestore buffers a read it cannot reach the server with instead of
        // rejecting, which would leave this button disabled with no feedback,
        // so the read is raced against the shared fail-fast timeout.
        registered = (
          await writeWithTimeout(
            () => getDoc(userDoc(user.uid)),
            () => {},
            WRITE_TIMEOUT_MS,
          )
        ).exists();
      } catch (e) {
        // Firestore codes (`unavailable`, `permission-denied`) are not auth
        // codes: the outer catch would fall through to the SDK's own English
        // message, so map them here through the data-error counterpart.
        await signOut(auth);
        setError(mapDataError((e as { code?: string }).code ?? ""));
        return;
      }
      if (!registered) {
        // Signing in just to be refused would otherwise leave the Auth record
        // this very call created behind: no profile, no claims, no password.
        // Delete it rather than accumulate dormant accounts for everyone who
        // taps Google without an account. A record that already existed is only
        // signed out — it may belong to someone mid-registration.
        if (isNewUser) await deleteUser(user).catch(() => signOut(auth));
        else await signOut(auth);
        setError(
          "Aucun compte Bike-eco n’est associé à ce compte Google. Créez un compte pour continuer.",
        );
        return;
      }
      // The root AuthGate redirects on the resulting auth-state change.
    },
    // `signInWithGoogle` throws either a Firebase `auth/*` error or one of our
    // own already-French errors ("Connexion Google annulée.", an email
    // mismatch); `frenchAuthMessage` is what tells the two apart.
    { mapError: frenchAuthMessage, onError: setError },
  );

  const sendingReset = useAsyncAction(async (email: string) => {
    clearMessages();
    if (!email) {
      setError("Saisissez votre email pour réinitialiser le mot de passe.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setNotice(RESET_SENT);
    } catch (e) {
      const code = (e as { code?: string }).code ?? "";
      // Never reveal whether an address has an account: an unknown email gets
      // the same confirmation as a known one. (Firebase's email-enumeration
      // protection already resolves in that case — this covers a project where
      // it is off.) Handled here rather than through `mapError` because only
      // this call site turns a failure into a success message.
      if (code === "auth/user-not-found") {
        setNotice(RESET_SENT);
        return;
      }
      setError(mapPasswordResetError(code));
    }
  });

  return (
    <PhotoBackground>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Bienvenue !</Text>
          <SignInFields
            onSubmit={(email, password) => void signingIn.run(email, password)}
            submitting={signingIn.pending}
            onForgotPassword={(email) => void sendingReset.run(email)}
            forgotDisabled={sendingReset.pending}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          <ThirdPartyAuthButtons
            onPress={(provider) => {
              if (provider === "google") void googleSigningIn.run();
            }}
            disabled={googleSigningIn.pending}
          />
          <View style={styles.dividerRow}>
            <View style={styles.line} />
            <Text style={styles.or}>Pas encore de compte ?</Text>
            <View style={styles.line} />
          </View>
          <Button
            variant="outlined"
            label="Créer un compte"
            onPress={() => router.push("/(auth)/register")}
          />
          <Button
            variant="outlined"
            label="J'ai un code d'invitation"
            onPress={() => router.push("/(auth)/invite-code")}
          />
        </View>
      </ScrollView>
    </PhotoBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: tokens.space.lg,
  },
  card: {
    gap: tokens.space.lg,
    padding: tokens.space.lg,
    borderRadius: tokens.radius.lg,
    backgroundColor: tokens.colors.surface,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  title: { ...tokens.text.title, textAlign: "center" },
  error: {
    ...tokens.text.subtitle,
    textAlign: "center",
    color: tokens.colors.danger,
  },
  notice: {
    ...tokens.text.subtitle,
    textAlign: "center",
    color: tokens.colors.primary,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.md,
  },
  line: { flex: 1, height: 1, backgroundColor: tokens.colors.border },
  or: { fontSize: 13, color: tokens.colors.muted },
});
