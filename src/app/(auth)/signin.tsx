import SignInFields from "@/components/form/SignInFields";
import Button from "@/components/ui/Button";
import PhotoBackground from "@/components/ui/PhotoBackground";
import ThirdPartyAuthButtons from "@/components/ui/ThirdPartyAuthButtons";
import { mapAuthError } from "@/lib/auth/authErrors";
import { tokens } from "@/theme/tokens";
import { useRouter } from "expo-router";
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth } from "../../../firebaseConfig";

export default function SignInScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSignIn = async (email: string, password: string) => {
    setError(null);
    setNotice(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // The root AuthGate redirects on the resulting auth-state change.
    } catch (e) {
      setError(mapAuthError((e as { code?: string }).code ?? ""));
    }
  };

  const handleForgot = async (email: string) => {
    setError(null);
    if (!email) {
      setError(
        "Saisissez d’abord votre email pour réinitialiser le mot de passe.",
      );
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setNotice(
        "Email de réinitialisation envoyé. Vérifiez votre boîte de réception.",
      );
    } catch (e) {
      setError(mapAuthError((e as { code?: string }).code ?? ""));
    }
  };

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
            onSubmit={handleSignIn}
            onForgotPassword={handleForgot}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {/* Interim no-op; Google is wired into this call site in Task 9. */}
          <ThirdPartyAuthButtons onPress={() => {}} />
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
  registerLink: {
    fontSize: 14,
    color: tokens.colors.primary,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.space.md,
  },
  line: { flex: 1, height: 1, backgroundColor: tokens.colors.border },
  or: { fontSize: 13, color: tokens.colors.muted },
});
