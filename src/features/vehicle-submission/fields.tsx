import type { ReactNode } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { StyleSheet, Text } from "react-native";

import ControlledCheckboxGroup from "@/components/form/ControlledCheckboxGroup";
import ControlledDropdown from "@/components/form/ControlledDropdown";
import ControlledField from "@/components/form/ControlledField";
import PhotoPicker from "@/components/form/PhotoPicker";
import {
  COUNT_OPTIONS,
  ETAT_OPTIONS,
  MATERIEL_OPTIONS,
  OUI_NON,
  RESULTAT_CT_OPTIONS,
} from "@/constants/vehicle";
import { digitsOnly } from "@/lib/forms/transforms";
import { tokens } from "@/theme/tokens";

/**
 * The vehicle steps shared by the two submission funnels — public B2C
 * (`form-b2c-vehicule-submission.md`) and logged-in B2B
 * (`form-b2b-vehicule-submission.md`).
 *
 * The specs give both funnels the same questions from "véhicule électrique"
 * through "prix souhaité", so the field groups live here once and each funnel's
 * `steps.tsx` is left holding only its own step table plus the parts that
 * genuinely differ (B2C's coordonnées, cylindrée and modalités; B2B's merged
 * "Modèle et Cylindrée"). This mirrors how `@/features/registration/fields`
 * serves the two registration funnels.
 *
 * Any copy change here must be made in **both** specs, since it lands in both
 * funnels at once.
 */

/**
 * The vehicle fields both funnels' schemas define identically. Declared here so
 * these groups can watch and control them without knowing which funnel they are
 * rendering — both `B2cSubmissionForm` and `B2bSubmissionForm` are supersets.
 */
interface VehicleFields {
  electrique: string;
  materiel: string[];
  aClesContact: string | null;
  cleNoire: string | null;
  cleMarron: string | null;
  cleRouge: string | null;
  aTelecommande: string | null;
  telecommande: string | null;
  etat: string | null;
  naturePanne: string;
  carteGrise: string | null;
  carteGriseAVotreNom: string | null;
  controleTechnique: string | null;
  ctMoins6Mois: string | null;
  resultatCT: string | null;
  certificatNonGage: string | null;
  carnetEntretien: string | null;
  factureEntretien: string | null;
  photos: string[];
  prix: string;
  commentaires: string;
}

export function ElectriqueFields() {
  const electrique = useWatch<VehicleFields, "electrique">({
    name: "electrique",
  });
  return (
    <>
      <ControlledDropdown
        name="electrique"
        label="S'agit-il d'un véhicule électrique ?"
        options={OUI_NON}
      />
      {electrique === "oui" && (
        <ControlledCheckboxGroup
          name="materiel"
          label="Cochez le matériel en votre possession"
          options={MATERIEL_OPTIONS}
        />
      )}
    </>
  );
}

export function ClesFields() {
  const aClesContact = useWatch<VehicleFields, "aClesContact">({
    name: "aClesContact",
  });
  const aTelecommande = useWatch<VehicleFields, "aTelecommande">({
    name: "aTelecommande",
  });
  return (
    <>
      <ControlledDropdown
        name="aClesContact"
        label="Avez-vous des clés de contact ?"
        options={OUI_NON}
      />
      {aClesContact === "oui" && (
        <>
          <ControlledDropdown
            name="cleNoire"
            label="Clé noire"
            options={COUNT_OPTIONS}
          />
          <ControlledDropdown
            name="cleMarron"
            label="Clé marron"
            options={COUNT_OPTIONS}
          />
          <ControlledDropdown
            name="cleRouge"
            label="Clé rouge"
            options={COUNT_OPTIONS}
          />
        </>
      )}
      <ControlledDropdown
        name="aTelecommande"
        label="Avez-vous une télécommande ou un Bip de démarrage ?"
        options={OUI_NON}
      />
      {aTelecommande === "oui" && (
        <ControlledDropdown
          name="telecommande"
          label="Télécommande / Bip de démarrage"
          options={COUNT_OPTIONS}
        />
      )}
    </>
  );
}

export function EtatFields() {
  const etat = useWatch<VehicleFields, "etat">({ name: "etat" });
  return (
    <>
      <ControlledDropdown
        name="etat"
        label="Dans quel état se trouve votre moto ?"
        placeholder="Etat du véhicule"
        options={ETAT_OPTIONS}
      />
      {etat === "En Panne" && (
        <ControlledField
          name="naturePanne"
          label="Connaissez-vous la panne ?"
          placeholder="Nature de la panne"
          returnKeyType="done"
        />
      )}
    </>
  );
}

/**
 * `nonGageLink` renders directly under the "certificat de non-gage" question.
 * Only the public B2C funnel offers it — a dealer already has the SIV account
 * the link points at.
 */
export function PapiersFields({ nonGageLink }: { nonGageLink?: ReactNode }) {
  const carteGrise = useWatch<VehicleFields, "carteGrise">({
    name: "carteGrise",
  });
  const controleTechnique = useWatch<VehicleFields, "controleTechnique">({
    name: "controleTechnique",
  });
  return (
    <>
      <ControlledDropdown
        name="carteGrise"
        label="Avez-vous la carte grise du véhicule ?"
        options={OUI_NON}
      />
      {carteGrise === "oui" && (
        <ControlledDropdown
          name="carteGriseAVotreNom"
          label="La carte grise est-elle à votre nom ?"
          options={OUI_NON}
        />
      )}
      <ControlledDropdown
        name="controleTechnique"
        label="Avez-vous le Contrôle Technique ?"
        options={OUI_NON}
      />
      {controleTechnique === "oui" && (
        <>
          <ControlledDropdown
            name="ctMoins6Mois"
            label="Contrôle technique de moins de 6 mois ?"
            options={OUI_NON}
          />
          <ControlledDropdown
            name="resultatCT"
            label="Résultat obtenu ?"
            options={RESULTAT_CT_OPTIONS}
          />
        </>
      )}
      {nonGageLink ?? (
        <ControlledDropdown
          name="certificatNonGage"
          label="Avez-vous le certificat de non-gage ?"
          options={OUI_NON}
        />
      )}
      <ControlledDropdown
        name="carnetEntretien"
        label="Carnet d'entretien"
        options={OUI_NON}
      />
      <ControlledDropdown
        name="factureEntretien"
        label="Facture d'entretien"
        options={OUI_NON}
      />
    </>
  );
}

/** The "certificat de non-gage" question on its own, for a funnel that wraps it
 *  with the SIV link. Kept here so the label cannot drift from the plain one. */
export function CertificatNonGageField() {
  return (
    <ControlledDropdown
      name="certificatNonGage"
      label="Avez-vous le certificat de non-gage ?"
      options={OUI_NON}
    />
  );
}

export function PhotosFields() {
  const { control } = useFormContext<VehicleFields>();
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
          />
        )}
      />
    </>
  );
}

export function PrixFields() {
  return (
    <>
      <ControlledField
        name="prix"
        label="Prix souhaité"
        placeholder="€"
        keyboardType="numeric"
        suffix="€"
        transform={digitsOnly()}
        returnKeyType="next"
      />
      <ControlledField
        name="commentaires"
        label="Commentaires"
        placeholder="Informations complémentaires"
        multiline
        returnKeyType="done"
      />
    </>
  );
}

/** Shared by both funnels' "Marque / Année / Kilométrage" block. The modèle,
 *  cylindrée and free-text fields differ per spec and stay in each `steps.tsx`. */
export function MarqueField() {
  return (
    <ControlledField
      name="marque"
      label="Marque"
      placeholder="Marque du véhicule"
      autoCapitalize="words"
      returnKeyType="next"
    />
  );
}

export function AnneeKilometrageFields() {
  return (
    <>
      <ControlledField
        name="annee"
        label="Année"
        placeholder="Année de mise en service"
        keyboardType="numeric"
        maxLength={4}
        transform={digitsOnly(4)}
        returnKeyType="next"
      />
      <ControlledField
        name="kilometrage"
        label="Kilométrage"
        placeholder="Kilométrage du véhicule"
        keyboardType="numeric"
        suffix="km"
        transform={digitsOnly()}
        returnKeyType="next"
      />
    </>
  );
}

/** The step field lists shared by both funnels, so a field added to a group
 *  above cannot be forgotten in the per-funnel step tables. */
export const VEHICLE_STEP_FIELDS = {
  electrique: ["electrique", "materiel"],
  cles: [
    "aClesContact",
    "cleNoire",
    "cleMarron",
    "cleRouge",
    "aTelecommande",
    "telecommande",
  ],
  etat: ["etat", "naturePanne"],
  papiers: [
    "carteGrise",
    "carteGriseAVotreNom",
    "controleTechnique",
    "ctMoins6Mois",
    "resultatCT",
    "certificatNonGage",
    "carnetEntretien",
    "factureEntretien",
  ],
  photos: ["photos"],
  prix: ["prix", "commentaires"],
} as const;

const styles = StyleSheet.create({
  hint: { fontSize: 14, color: tokens.colors.muted, lineHeight: 20 },
});
