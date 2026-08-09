import type { ReactNode } from "react";

import ControlledField from "@/components/form/ControlledField";
import {
  AnneeKilometrageFields,
  ClesFields,
  ElectriqueFields,
  EtatFields,
  MarqueField,
  PapiersFields,
  PhotosFields,
  PrixFields,
  VEHICLE_STEP_FIELDS,
} from "@/features/vehicle-submission/fields";
import type { StepConfig } from "@/lib/forms/useStepForm";
import type { B2bSubmissionForm } from "./schema";

export type B2bStep = StepConfig<B2bSubmissionForm> & { render: () => ReactNode };

/** B2B merges cylindrée into the modèle field and asks for "Commentaires"
 *  rather than the B2C "Accessoires" — see `form-b2b-vehicule-submission.md`. */
function MotoFields() {
  return (
    <>
      <MarqueField />
      <ControlledField
        name="modele"
        label="Modèle et Cylindrée"
        placeholder="Modèle du véhicule"
        autoCapitalize="words"
        returnKeyType="next"
      />
      <AnneeKilometrageFields />
      <ControlledField
        name="accessoires"
        label="Commentaires"
        placeholder="Ex. Etat de la moto"
        multiline
        returnKeyType="done"
      />
    </>
  );
}

export const B2B_SUBMISSION_STEPS: B2bStep[] = [
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
    fields: ["marque", "modele", "annee", "kilometrage", "accessoires"],
    render: () => <MotoFields />,
  },
  {
    progress: 30,
    title: "Informations véhicule",
    subtitle: "Quelles clés et télécommandes avez-vous?",
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
    render: () => <PapiersFields />,
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
];
