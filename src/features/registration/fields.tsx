import { Alert, StyleSheet, Text, TouchableOpacity } from "react-native";

import ControlledDropdown from "@/components/form/ControlledDropdown";
import ControlledField from "@/components/form/ControlledField";
import { DEPARTMENTS } from "@/constants/departments";
import { digitsOnly } from "@/lib/forms/transforms";
import { tokens } from "@/theme/tokens";

/** Step "Votre compte": email + password + Google (stubbed). `emailDisabled`
 *  prefills+locks the email for the invited-registration flow. */
export function AccountFields({ emailDisabled = false }: { emailDisabled?: boolean }) {
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
        returnKeyType="done"
      />
      <TouchableOpacity
        style={styles.google}
        activeOpacity={0.7}
        onPress={() =>
          Alert.alert("Google", "Authentification Google bientôt disponible.")
        }
      >
        <Text style={styles.googleText}>Continuer avec Google</Text>
      </TouchableOpacity>
      <Text style={styles.note}>* Champs obligatoires</Text>
    </>
  );
}

/** Step "Vos coordonnées": shared by company + invited registration. */
export function CoordonneesFields() {
  return (
    <>
      <ControlledField name="nom" label="Nom *" placeholder="Votre nom" autoCapitalize="words" autoComplete="family-name" returnKeyType="next" />
      <ControlledField name="prenom" label="Prénom *" placeholder="Votre prénom" autoCapitalize="words" autoComplete="given-name" returnKeyType="next" />
      <ControlledField name="telephone" label="Téléphone *" placeholder="Votre numéro de téléphone" keyboardType="phone-pad" autoComplete="tel" transform={digitsOnly(10)} />
      <ControlledDropdown name="departement" label="Département *" placeholder="Département" options={DEPARTMENTS} searchable />
      <ControlledField name="ville" label="Ville *" placeholder="Ville" autoCapitalize="words" returnKeyType="done" />
      <Text style={styles.note}>* Champs obligatoires</Text>
    </>
  );
}

const styles = StyleSheet.create({
  google: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    borderWidth: 1.5,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  googleText: { fontSize: 16, fontWeight: "600", color: tokens.colors.primary },
  note: { fontSize: 12, color: tokens.colors.muted },
});
