import type { ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import ControlledCheckboxGroup from "@/components/form/ControlledCheckboxGroup";
import ControlledDropdown from "@/components/form/ControlledDropdown";
import ControlledField from "@/components/form/ControlledField";
import PhotoPicker from "@/components/form/PhotoPicker";
import { DEPARTMENTS, isNord, isSud } from "@/constants/departments";
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
import type { B2cSubmissionForm } from "./schema";

export type B2cStep = StepConfig<B2cSubmissionForm> & { render: () => ReactNode };

const NON_GAGE_URL =
  "https://siv.interieur.gouv.fr/map-usg-ui/do/accueil_certificat";

// ─── step field layouts ──────────────────────────────────────────────────────

function CoordonneesFields() {
  return (
    <>
      <ControlledField name="nom" label="Nom" placeholder="Votre nom" autoCapitalize="words" autoComplete="family-name" returnKeyType="next" />
      <ControlledField name="prenom" label="Prénom" placeholder="Votre prénom" autoCapitalize="words" autoComplete="given-name" returnKeyType="next" />
      <ControlledField name="email" label="Adresse email" placeholder="Votre email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" returnKeyType="next" />
      <ControlledField name="telephone" label="Téléphone" placeholder="Votre numéro de téléphone" keyboardType="phone-pad" autoComplete="tel" transform={digitsOnly(10)} />
      <ControlledDropdown name="departement" label="Département" placeholder="Département" options={DEPARTMENTS} searchable />
      <ControlledField name="ville" label="Ville" placeholder="Ville" autoCapitalize="words" returnKeyType="done" />
    </>
  );
}

function ElectriqueFields() {
  const electrique = useWatch<B2cSubmissionForm, "electrique">({ name: "electrique" });
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
      <ControlledField name="modele" label="Modèle" placeholder="Modèle du véhicule" autoCapitalize="words" returnKeyType="next" />
      <ControlledField name="cylindree" label="Cylindrée" placeholder="Cylindrée du véhicule en CC" keyboardType="numeric" suffix="cc" transform={digitsOnly()} returnKeyType="next" />
      <ControlledField name="annee" label="Année" placeholder="Année de mise en service" keyboardType="numeric" maxLength={4} transform={digitsOnly(4)} returnKeyType="next" />
      <ControlledField name="kilometrage" label="Kilométrage" placeholder="Kilométrage du véhicule" keyboardType="numeric" suffix="km" transform={digitsOnly()} returnKeyType="next" />
      <ControlledField name="accessoires" label="Accessoires" placeholder="Listez ici les éventuels accessoires" multiline returnKeyType="done" />
    </>
  );
}

function ClesFields() {
  const aClesContact = useWatch<B2cSubmissionForm, "aClesContact">({ name: "aClesContact" });
  const aTelecommande = useWatch<B2cSubmissionForm, "aTelecommande">({ name: "aTelecommande" });
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
  const etat = useWatch<B2cSubmissionForm, "etat">({ name: "etat" });
  return (
    <>
      <ControlledDropdown name="etat" label="Dans quel état se trouve votre moto ?" placeholder="Etat du véhicule" options={ETAT_OPTIONS} />
      {etat === "En Panne" && (
        <ControlledField name="naturePanne" label="Connaissez-vous la panne ?" placeholder="Nature de la panne" returnKeyType="done" />
      )}
    </>
  );
}

function PapiersFields() {
  const carteGrise = useWatch<B2cSubmissionForm, "carteGrise">({ name: "carteGrise" });
  const controleTechnique = useWatch<B2cSubmissionForm, "controleTechnique">({ name: "controleTechnique" });
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
      <View>
        <ControlledDropdown name="certificatNonGage" label="Avez-vous le certificat de non-gage ?" options={OUI_NON} />
        <TouchableOpacity onPress={() => Linking.openURL(NON_GAGE_URL)} activeOpacity={0.7}>
          <Text style={styles.link}>Demander un certificat de non-gage</Text>
        </TouchableOpacity>
      </View>
      <ControlledDropdown name="carnetEntretien" label="Carnet d'entretien" options={OUI_NON} />
      <ControlledDropdown name="factureEntretien" label="Facture d'entretien" options={OUI_NON} />
    </>
  );
}

function PhotosFields() {
  const { control } = useFormContext<B2cSubmissionForm>();
  return (
    <>
      <Text style={styles.hint}>
        Ajoutez des photos de bonne qualité, montrant plusieurs faces de la moto.
      </Text>
      <Controller
        control={control}
        name="photos"
        render={({ field, fieldState }) => (
          <PhotoPicker
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            min={1}
          />
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

function ModaliteFields() {
  const departement = useWatch<B2cSubmissionForm, "departement">({ name: "departement" });
  const options = ["Enlèvement à domicile"];
  if (departement && isNord(departement)) {
    options.push("Je dépose la moto au centre de Montargis");
  }
  if (departement && isSud(departement)) {
    options.push("Je dépose la moto au centre de Vitrolles");
  }
  return (
    <ControlledDropdown name="modalite" label="Comment souhaitez-vous faire la reprise du véhicule ?" options={options} />
  );
}

// ─── step definitions ────────────────────────────────────────────────────────

export const B2C_SUBMISSION_STEPS: B2cStep[] = [
  {
    progress: 0,
    title: "Vos coordonnées",
    fields: ["nom", "prenom", "email", "telephone", "departement", "ville"],
    render: () => <CoordonneesFields />,
  },
  {
    progress: 10,
    title: "Informations véhicule",
    subtitle: "Quelle est votre moto?",
    fields: ["electrique", "materiel"],
    render: () => <ElectriqueFields />,
  },
  {
    progress: 20,
    title: "Informations véhicule",
    subtitle: "Quelle est votre moto?",
    fields: ["marque", "modele", "cylindree", "annee", "kilometrage", "accessoires"],
    render: () => <MotoFields />,
  },
  {
    progress: 30,
    title: "Informations véhicule",
    subtitle: "Quelles clés et télécommandes avez-vous?",
    fields: ["aClesContact", "cleNoire", "cleMarron", "cleRouge", "aTelecommande", "telecommande"],
    render: () => <ClesFields />,
  },
  {
    progress: 40,
    title: "Informations véhicule",
    subtitle: "Précisions concernant l'état du véhicule",
    fields: ["etat", "naturePanne"],
    render: () => <EtatFields />,
  },
  {
    progress: 50,
    title: "Informations véhicule",
    subtitle: "Quels papiers du véhicule sont en votre possession?",
    fields: [
      "carteGrise",
      "carteGriseAVotreNom",
      "controleTechnique",
      "ctMoins6Mois",
      "resultatCT",
      "certificatNonGage",
      "carnetEntretien",
      "factureEntretien",
    ],
    render: () => <PapiersFields />,
  },
  {
    progress: 60,
    title: "Photos du véhicule",
    subtitle: "Ajoutez au moins 1 photo récente",
    fields: ["photos"],
    render: () => <PhotosFields />,
  },
  {
    progress: 70,
    title: "Prix souhaité",
    subtitle: "Indiquez le prix souhaité, en euros",
    fields: ["prix", "commentaires"],
    render: () => <PrixFields />,
  },
  {
    progress: 80,
    title: "Modalités de reprise du véhicule",
    subtitle:
      "Vous pouvez nous déposer le véhicule, ou demander l'enlèvement 100% gratuit",
    fields: ["modalite"],
    render: () => <ModaliteFields />,
  },
];

const styles = StyleSheet.create({
  link: {
    fontSize: 13,
    color: tokens.colors.muted,
    textDecorationLine: "underline",
    marginTop: tokens.space.sm,
  },
  hint: {
    fontSize: 14,
    color: tokens.colors.muted,
    lineHeight: 20,
  },
});
