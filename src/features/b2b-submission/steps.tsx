import type { ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { StyleSheet, Text } from "react-native";

import ControlledCheckboxGroup from "@/components/form/ControlledCheckboxGroup";
import ControlledDropdown from "@/components/form/ControlledDropdown";
import ControlledField from "@/components/form/ControlledField";
import PhotoPicker from "@/components/form/PhotoPicker";
import { MAX_PHOTOS } from "@/constants/photos";
import {
  COUNT_OPTIONS,
  ETAT_OPTIONS,
  MATERIEL_OPTIONS,
  OUI_NON,
  RESULTAT_CT_OPTIONS,
} from "@/constants/vehicle";
import { digitsOnly } from "@/lib/forms/transforms";
import type { StepConfig } from "@/lib/forms/useStepForm";
import { tokens } from "@/theme/tokens";
import type { B2bSubmissionForm } from "./schema";

export type B2bStep = StepConfig<B2bSubmissionForm> & { render: () => ReactNode };

function ElectriqueFields() {
  const electrique = useWatch<B2bSubmissionForm, "electrique">({ name: "electrique" });
  return (
    <>
      <ControlledDropdown name="electrique" label="S'agit-il d'un véhicule électrique ?" options={OUI_NON} />
      {electrique === "oui" && (
        <ControlledCheckboxGroup name="materiel" label="Cochez le matériel en votre possession" options={MATERIEL_OPTIONS} />
      )}
    </>
  );
}

function MotoFields() {
  return (
    <>
      <ControlledField name="marque" label="Marque" placeholder="Marque du véhicule" autoCapitalize="words" returnKeyType="next" />
      <ControlledField name="modele" label="Modèle et Cylindrée" placeholder="Modèle du véhicule" autoCapitalize="words" returnKeyType="next" />
      <ControlledField name="annee" label="Année" placeholder="Année de mise en service" keyboardType="numeric" maxLength={4} transform={digitsOnly(4)} returnKeyType="next" />
      <ControlledField name="kilometrage" label="Kilométrage" placeholder="Kilométrage du véhicule" keyboardType="numeric" suffix="km" transform={digitsOnly()} returnKeyType="next" />
      <ControlledField name="accessoires" label="Commentaires" placeholder="Ex. État de la moto" multiline returnKeyType="done" />
    </>
  );
}

function ClesFields() {
  const aClesContact = useWatch<B2bSubmissionForm, "aClesContact">({ name: "aClesContact" });
  const aTelecommande = useWatch<B2bSubmissionForm, "aTelecommande">({ name: "aTelecommande" });
  return (
    <>
      <ControlledDropdown name="aClesContact" label="Avez-vous des clés de contact ?" options={OUI_NON} />
      {aClesContact === "oui" && (
        <>
          <ControlledDropdown name="cleNoire" label="Clé noire" options={COUNT_OPTIONS} />
          <ControlledDropdown name="cleMarron" label="Clé marron" options={COUNT_OPTIONS} />
          <ControlledDropdown name="cleRouge" label="Clé rouge" options={COUNT_OPTIONS} />
        </>
      )}
      <ControlledDropdown name="aTelecommande" label="Avez-vous une télécommande ou un Bip de démarrage ?" options={OUI_NON} />
      {aTelecommande === "oui" && (
        <ControlledDropdown name="telecommande" label="Télécommande / Bip de démarrage" options={COUNT_OPTIONS} />
      )}
    </>
  );
}

function EtatFields() {
  const etat = useWatch<B2bSubmissionForm, "etat">({ name: "etat" });
  return (
    <>
      <ControlledDropdown name="etat" label="Dans quel état se trouve votre moto ?" placeholder="État du véhicule" options={ETAT_OPTIONS} />
      {etat === "En Panne" && (
        <ControlledField name="naturePanne" label="Connaissez-vous la panne ?" placeholder="Nature de la panne" returnKeyType="done" />
      )}
    </>
  );
}

function PapiersFields() {
  const carteGrise = useWatch<B2bSubmissionForm, "carteGrise">({ name: "carteGrise" });
  const controleTechnique = useWatch<B2bSubmissionForm, "controleTechnique">({ name: "controleTechnique" });
  return (
    <>
      <ControlledDropdown name="carteGrise" label="Avez-vous la carte grise du véhicule ?" options={OUI_NON} />
      {carteGrise === "oui" && (
        <ControlledDropdown name="carteGriseAVotreNom" label="La carte grise est-elle à votre nom ?" options={OUI_NON} />
      )}
      <ControlledDropdown name="controleTechnique" label="Avez-vous le Contrôle Technique ?" options={OUI_NON} />
      {controleTechnique === "oui" && (
        <>
          <ControlledDropdown name="ctMoins6Mois" label="Contrôle technique de moins de 6 mois ?" options={OUI_NON} />
          <ControlledDropdown name="resultatCT" label="Résultat obtenu ?" options={RESULTAT_CT_OPTIONS} />
        </>
      )}
      <ControlledDropdown name="certificatNonGage" label="Avez-vous le certificat de non-gage ?" options={OUI_NON} />
      <ControlledDropdown name="carnetEntretien" label="Carnet d'entretien" options={OUI_NON} />
      <ControlledDropdown name="factureEntretien" label="Facture d'entretien" options={OUI_NON} />
    </>
  );
}

function PhotosFields() {
  const { control } = useFormContext<B2bSubmissionForm>();
  return (
    <>
      <Text style={styles.hint}>
        Ajoutez des photos de bonne qualité, montrant plusieurs faces de la moto.
      </Text>
      <Controller
        control={control}
        name="photos"
        render={({ field, fieldState }) => (
          <PhotoPicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} min={1} max={MAX_PHOTOS} />
        )}
      />
    </>
  );
}

function PrixFields() {
  return (
    <>
      <ControlledField name="prix" label="Prix souhaité" placeholder="€" keyboardType="numeric" suffix="€" transform={digitsOnly()} returnKeyType="next" />
      <ControlledField name="commentaires" label="Commentaires" placeholder="Informations complémentaires" multiline returnKeyType="done" />
    </>
  );
}

export const B2B_SUBMISSION_STEPS: B2bStep[] = [
  { progress: 10, title: "Informations véhicule", subtitle: "Quelle est votre moto?", fields: ["electrique", "materiel"], render: () => <ElectriqueFields /> },
  { progress: 20, title: "Informations véhicule", subtitle: "Quelle est votre moto?", fields: ["marque", "modele", "annee", "kilometrage", "accessoires"], render: () => <MotoFields /> },
  { progress: 30, title: "Informations véhicule", subtitle: "Quelles clés et télécommandes avez-vous?", fields: ["aClesContact", "cleNoire", "cleMarron", "cleRouge", "aTelecommande", "telecommande"], render: () => <ClesFields /> },
  { progress: 40, title: "Informations véhicule", subtitle: "Précisions concernant l'état du véhicule", fields: ["etat", "naturePanne"], render: () => <EtatFields /> },
  { progress: 50, title: "Informations véhicule", subtitle: "Quels papiers du véhicule sont en votre possession?", fields: ["carteGrise", "carteGriseAVotreNom", "controleTechnique", "ctMoins6Mois", "resultatCT", "certificatNonGage", "carnetEntretien", "factureEntretien"], render: () => <PapiersFields /> },
  { progress: 60, title: "Photos du véhicule", subtitle: "Ajoutez au moins 1 photo récente", fields: ["photos"], render: () => <PhotosFields /> },
  { progress: 70, title: "Prix souhaité", subtitle: "Indiquez le prix souhaité, en euros", fields: ["prix", "commentaires"], render: () => <PrixFields /> },
];

const styles = StyleSheet.create({
  hint: { fontSize: 14, color: tokens.colors.muted, lineHeight: 20 },
});
