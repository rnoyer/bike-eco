import { useFormContext } from "react-hook-form";
import { Alert, StyleSheet, Text } from "react-native";

import ControlledField from "@/components/form/ControlledField";
import ThirdPartyAuthButtons from "@/components/ui/ThirdPartyAuthButtons";
import type { B2bCompanyRegistrationForm } from "@/features/b2b-registration/schema";
import { signInWithGoogle } from "@/lib/auth/googleSignIn";
import { digitsOnly } from "@/lib/forms/transforms";
import { tokens } from "@/theme/tokens";
import { useGoogleAuthReporter } from "./googleAuth";

/** Step "Votre compte": email + password + Google. `emailDisabled`
 *  prefills+locks the email for the invited-registration flow. */
export function AccountFields({
  emailDisabled = false,
}: {
  emailDisabled?: boolean;
}) {
  const form = useFormContext<B2bCompanyRegistrationForm>();
  const { onGoogleProfile } = useGoogleAuthReporter();

  async function handleAuthPress(provider: "google" | "apple" | "facebook") {
    if (provider !== "google") return;
    try {
      // Invited flow only (`emailDisabled` locks the email to the invitation):
      // a mismatch throws, so `onGoogleProfile` below is never reached and the
      // funnel stays on this step instead of failing at the final submit.
      const profile = await signInWithGoogle({
        expectedEmail: emailDisabled ? form.getValues("email") : undefined,
      });
      form.setValue("prenom", profile.prenom ?? "");
      form.setValue("nom", profile.nom ?? "");
      if (!emailDisabled) form.setValue("email", profile.email ?? "");
      // Google flow uses the authenticated identity from Auth, so the account
      // step should not block on a manual password. Seed a non-empty placeholder
      // value so the shared step-validator can advance to the coordinates step.
      // Both fields get the same value — the schema's equality check runs on
      // this step, so seeding only `password` would block the Google path.
      form.setValue("password", "google-auth-placeholder");
      form.setValue("confirmPassword", "google-auth-placeholder");
      await onGoogleProfile(profile);
    } catch (err) {
      Alert.alert(
        "Connexion Google",
        err instanceof Error ? err.message : "Veuillez réessayer.",
      );
    }
  }

  return (
    <>
      <ControlledField
        name="email"
        label="Adresse email *"
        placeholder="Votre email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        editable={!emailDisabled}
        returnKeyType="next"
      />
      <ControlledField
        name="password"
        label="Mot de passe *"
        placeholder="Mot de passe"
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="next"
      />
      <ControlledField
        name="confirmPassword"
        label="Confirmer le mot de passe *"
        placeholder="Confirmer le mot de passe"
        secureTextEntry
        autoCapitalize="none"
        returnKeyType="done"
      />
      <ThirdPartyAuthButtons onPress={handleAuthPress} />
      <Text style={styles.note}>* Champs obligatoires</Text>
    </>
  );
}

/** Step "Vos coordonnées": shared by company + invited registration. */
export function CoordonneesFields() {
  return (
    <>
      <ControlledField
        name="nom"
        label="Nom *"
        placeholder="Votre nom"
        autoCapitalize="words"
        autoComplete="family-name"
        returnKeyType="next"
      />
      <ControlledField
        name="prenom"
        label="Prénom *"
        placeholder="Votre prénom"
        autoCapitalize="words"
        autoComplete="given-name"
        returnKeyType="next"
      />
      <ControlledField
        name="telephone"
        label="Téléphone *"
        placeholder="Votre numéro de téléphone"
        keyboardType="phone-pad"
        autoComplete="tel"
        transform={digitsOnly(10)}
      />
      <Text style={styles.note}>* Champs obligatoires</Text>
    </>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 12, color: tokens.colors.muted },
});
