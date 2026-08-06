import type { ReactNode } from "react";
import { StyleSheet, Text } from "react-native";

import ControlledDropdown from "@/components/form/ControlledDropdown";
import ControlledField from "@/components/form/ControlledField";
import { DEPARTMENTS } from "@/constants/departments";
import { AccountFields, CoordonneesFields } from "@/features/registration/fields";
import { digitsOnly } from "@/lib/forms/transforms";
import { normalizeTva, TVA_LENGTH } from "@/lib/forms/tva";
import type { StepConfig } from "@/lib/forms/useStepForm";
import { tokens } from "@/theme/tokens";
import type { B2bCompanyRegistrationForm } from "./schema";

export type CompanyStep = StepConfig<B2bCompanyRegistrationForm> & {
  render: () => ReactNode;
};

function EntrepriseFields() {
  return (
    <>
      <ControlledField name="siret" label="Numéro SIRET *" placeholder="14 chiffres" keyboardType="numeric" maxLength={14} transform={digitsOnly(14)} returnKeyType="next" />
      <ControlledField name="tva" label="Numéro de TVA (optionnel)" placeholder="FR + clé (2) + 9 premiers chiffres du SIRET" autoCapitalize="characters" autoCorrect={false} maxLength={TVA_LENGTH} transform={normalizeTva} returnKeyType="next" />
      <ControlledField name="companyName" label="Nom de votre entreprise *" placeholder="Nom de votre entreprise" autoCapitalize="words" returnKeyType="next" />
      <ControlledDropdown name="companyDepartement" label="Département *" placeholder="Département" options={DEPARTMENTS} searchable />
      <ControlledField name="companyVille" label="Ville *" placeholder="Ville de l'entreprise" autoCapitalize="words" returnKeyType="done" />
      <Text style={styles.note}>* Champs obligatoires</Text>
    </>
  );
}

export const B2B_COMPANY_REGISTRATION_STEPS: CompanyStep[] = [
  {
    progress: 25,
    title: "Coordonnées Entreprise",
    subtitle: "Indiquez le numéro SIRET de votre entreprise",
    fields: ["siret", "tva", "companyName", "companyDepartement", "companyVille"],
    render: () => <EntrepriseFields />,
  },
  {
    progress: 50,
    title: "Votre compte",
    subtitle: "Informations relative à votre compte utilisateur",
    fields: ["email", "password", "confirmPassword"],
    render: () => <AccountFields />,
  },
  {
    progress: 75,
    title: "Vos coordonnées",
    subtitle: "Informations relative à votre compte utilisateur",
    fields: ["nom", "prenom", "telephone"],
    render: () => <CoordonneesFields />,
  },
];

const styles = StyleSheet.create({
  note: { fontSize: 12, color: tokens.colors.muted },
});
