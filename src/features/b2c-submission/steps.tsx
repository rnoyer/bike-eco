import type { ReactNode } from "react";
import { useWatch } from "react-hook-form";
import {
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import ControlledDropdown from "@/components/form/ControlledDropdown";
import ControlledField from "@/components/form/ControlledField";
import { DEPARTMENTS, isNord, isSud } from "@/constants/departments";
import {
  AnneeKilometrageFields,
  CertificatNonGageField,
  ClesFields,
  ElectriqueFields,
  EtatFields,
  MarqueField,
  PapiersFields,
  PhotosFields,
  PrixFields,
  VEHICLE_STEP_FIELDS,
} from "@/features/vehicle-submission/fields";
import { digitsOnly } from "@/lib/forms/transforms";
import type { StepConfig } from "@/lib/forms/useStepForm";
import { tokens } from "@/theme/tokens";
import type { B2cSubmissionForm } from "./schema";

export type B2cStep = StepConfig<B2cSubmissionForm> & {
  render: () => ReactNode;
};

const NON_GAGE_URL =
  "https://siv.interieur.gouv.fr/map-usg-ui/do/accueil_certificat";

// ─── step field layouts ──────────────────────────────────────────────────────

function CoordonneesFields() {
  return (
    <>
      <ControlledField
        name="nom"
        label="Nom"
        placeholder="Votre nom"
        autoCapitalize="words"
        autoComplete="family-name"
        returnKeyType="next"
      />
      <ControlledField
        name="prenom"
        label="Prénom"
        placeholder="Votre prénom"
        autoCapitalize="words"
        autoComplete="given-name"
        returnKeyType="next"
      />
      <ControlledField
        name="email"
        label="Adresse email"
        placeholder="Votre email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        returnKeyType="next"
      />
      <ControlledField
        name="telephone"
        label="Téléphone"
        placeholder="Votre numéro de téléphone"
        keyboardType="phone-pad"
        autoComplete="tel"
        transform={digitsOnly(10)}
      />
      <ControlledDropdown
        name="departement"
        label="Département"
        placeholder="Département"
        options={DEPARTMENTS}
        searchable
      />
      <ControlledField
        name="ville"
        label="Ville"
        placeholder="Ville"
        autoCapitalize="words"
        returnKeyType="done"
      />
    </>
  );
}

/** B2C asks for cylindrée as its own field and for "Accessoires" rather than the
 *  B2B "Commentaires" — see `form-b2c-vehicule-submission.md`. */
function MotoFields() {
  return (
    <>
      <MarqueField />
      <ControlledField
        name="modele"
        label="Modèle"
        placeholder="Modèle du véhicule"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <ControlledField
        name="cylindree"
        label="Cylindrée"
        placeholder="Cylindrée du véhicule en CC"
        keyboardType="numeric"
        suffix="cc"
        transform={digitsOnly()}
        returnKeyType="next"
      />
      <AnneeKilometrageFields />
      <ControlledField
        name="accessoires"
        label="Accessoires"
        placeholder="Listez ici les éventuels accessoires"
        multiline
        returnKeyType="done"
      />
    </>
  );
}

/** The public funnel pairs the non-gage question with a link to the SIV service
 *  that issues the certificate. */
function NonGageWithLink() {
  return (
    <View>
      <CertificatNonGageField />
      <TouchableOpacity
        onPress={() => Linking.openURL(NON_GAGE_URL)}
        activeOpacity={0.7}
      >
        <Text style={styles.link}>Demander un certificat de non-gage</Text>
      </TouchableOpacity>
    </View>
  );
}

function ModaliteFields() {
  const departement = useWatch<B2cSubmissionForm, "departement">({
    name: "departement",
  });
  const options = ["Enlèvement à domicile"];
  if (departement && isNord(departement)) {
    options.push("Je dépose la moto au centre de Pressigny-les-Pins");
  }
  if (departement && isSud(departement)) {
    options.push("Je dépose la moto au centre de Vitrolles");
  }
  return (
    <ControlledDropdown
      name="modalite"
      label="Comment souhaitez-vous faire l'enlèvement du véhicule ?"
      options={options}
    />
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
    fields: [...VEHICLE_STEP_FIELDS.electrique],
    render: () => <ElectriqueFields />,
  },
  {
    progress: 20,
    title: "Informations véhicule",
    subtitle: "Quelle est votre moto?",
    fields: [
      "marque",
      "modele",
      "cylindree",
      "annee",
      "kilometrage",
      "accessoires",
    ],
    render: () => <MotoFields />,
  },
  {
    progress: 30,
    title: "Informations véhicule",
    subtitle: "Quelles clés avez-vous?",
    fields: [...VEHICLE_STEP_FIELDS.cles],
    render: () => <ClesFields />,
  },
  {
    progress: 40,
    title: "Informations véhicule",
    subtitle: "Précisions concernant l'état du véhicule",
    fields: [...VEHICLE_STEP_FIELDS.etat],
    render: () => <EtatFields />,
  },
  {
    progress: 50,
    title: "Informations véhicule",
    subtitle: "Quels papiers du véhicule sont en votre possession?",
    fields: [...VEHICLE_STEP_FIELDS.papiers],
    render: () => <PapiersFields nonGageLink={<NonGageWithLink />} />,
  },
  {
    progress: 60,
    title: "Photos du véhicule",
    subtitle: "Ajoutez au moins 1 photo récente",
    fields: [...VEHICLE_STEP_FIELDS.photos],
    render: () => <PhotosFields />,
  },
  {
    progress: 70,
    title: "Prix souhaité",
    subtitle: "Indiquez le prix souhaité, en euros",
    fields: [...VEHICLE_STEP_FIELDS.prix],
    render: () => <PrixFields />,
  },
  {
    progress: 80,
    title: "Modalités de reprise du véhicule",
    subtitle:
      "Vous pouvez nous déposer le véhicule, ou demander son enlèvement.",
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
});
