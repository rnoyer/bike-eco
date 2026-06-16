import FormLayout from "@/components/form/FormLayout";
import Step1, {
  type Step1Data,
  type Step1Errors,
} from "@/components/form/Step1";
import Step2, { type Step2Data } from "@/components/form/Step2";
import Step3, { type Step3Data } from "@/components/form/Step3";
import Step4, { type Step4Data } from "@/components/form/Step4";
import Step5, { type Step5Data } from "@/components/form/Step5";
import Step6, { type Step6Data } from "@/components/form/Step6";
import Step7, { type Step7Data } from "@/components/form/Step7";
import Step8, { type Step8Data } from "@/components/form/Step8";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

// ─── initial state ────────────────────────────────────────────────────────────

const INITIAL_STEP1: Step1Data = {
  nom: "",
  prenom: "",
  email: "",
  telephone: "",
  departement: null,
  ville: "",
};
const INITIAL_STEP2: Step2Data = {
  marque: "",
  modele: "",
  cylindree: "",
  annee: "",
  kilometrage: "",
  accessoires: "",
};
const INITIAL_STEP3: Step3Data = {
  cleNoire: null,
  cleMarron: null,
  cleRouge: null,
  telecommande: null,
};
const INITIAL_STEP4: Step4Data = { etat: null, naturePanne: "" };
const INITIAL_STEP5: Step5Data = {
  carnetEntretien: null,
  factureEntretien: null,
  controleTechnique: null,
  ctMoins6Mois: null,
  carteGrise: null,
  carteGriseAVotreNom: null,
};
const INITIAL_STEP6: Step6Data = { photos: [] };
const INITIAL_STEP7: Step7Data = { prix: "", commentaires: "" };
const INITIAL_STEP8: Step8Data = { modalite: null };

// ─── step metadata ─────────────────────────────────────────────────────────────

const STEP_META: Record<
  number,
  { progress: number; title: string; subtitle?: string }
> = {
  1: { progress: 10, title: "Vos coordonnées" },
  2: {
    progress: 20,
    title: "Informations véhicule",
    subtitle: "Quelle est votre moto?",
  },
  3: {
    progress: 30,
    title: "Informations véhicule",
    subtitle: "Quelles clés et télécommandes avez-vous?",
  },
  4: {
    progress: 40,
    title: "Informations véhicule",
    subtitle: "Précisions concernant l'état du véhicule",
  },
  5: {
    progress: 50,
    title: "Informations véhicule",
    subtitle: "Quels papiers du véhicule sont en votre possession?",
  },
  6: {
    progress: 60,
    title: "Photos du véhicule",
    subtitle: "Ajoutez au moins 3 photos récentes",
  },
  7: {
    progress: 70,
    title: "Prix souhaité",
    subtitle: "Indiquez le prix souhaité, en euros",
  },
  8: {
    progress: 80,
    title: "Modalités de reprise du véhicule",
    subtitle:
      "Vous pouvez nous déposer le véhicule, ou demander l'enlèvement 100% gratuit",
  },
  9: {
    progress: 100,
    title: "Demande envoyée !",
    subtitle:
      "Un email récapitulatif va vous parvenir. /bVous serez recontacté très prochainement par notre équipe.",
  },
};

// ─── validation ────────────────────────────────────────────────────────────────

function validateStep1(data: Step1Data): Step1Errors {
  const errors: Step1Errors = {};
  if (!data.nom.trim()) errors.nom = "Ce champ est obligatoire";
  if (!data.prenom.trim()) errors.prenom = "Ce champ est obligatoire";
  if (!data.email.trim()) {
    errors.email = "Ce champ est obligatoire";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = "Email invalide";
  }
  if (!data.telephone.trim()) {
    errors.telephone = "Ce champ est obligatoire";
  } else if (data.telephone.length !== 10) {
    errors.telephone = "10 chiffres requis";
  }
  if (!data.departement) errors.departement = "Ce champ est obligatoire";
  if (!data.ville.trim()) errors.ville = "Ce champ est obligatoire";
  return errors;
}

// ─── screen ────────────────────────────────────────────────────────────────────

export default function FormScreen() {
  const [currentStep, setCurrentStep] = useState(1);

  const [step1Data, setStep1Data] = useState<Step1Data>(INITIAL_STEP1);
  const [step1Errors, setStep1Errors] = useState<Step1Errors>({});
  const [step2Data, setStep2Data] = useState<Step2Data>(INITIAL_STEP2);
  const [step3Data, setStep3Data] = useState<Step3Data>(INITIAL_STEP3);
  const [step4Data, setStep4Data] = useState<Step4Data>(INITIAL_STEP4);
  const [step5Data, setStep5Data] = useState<Step5Data>(INITIAL_STEP5);
  const [step6Data, setStep6Data] = useState<Step6Data>(INITIAL_STEP6);
  const [step7Data, setStep7Data] = useState<Step7Data>(INITIAL_STEP7);
  const [step8Data, setStep8Data] = useState<Step8Data>(INITIAL_STEP8);

  const meta = STEP_META[currentStep];

  function handleNext() {
    if (currentStep === 1) {
      const errors = validateStep1(step1Data);
      if (Object.keys(errors).length > 0) {
        setStep1Errors(errors);
        return;
      }
      setStep1Errors({});
    }

    if (currentStep === 6 && step6Data.photos.length < 3) {
      Alert.alert(
        "Photos manquantes",
        "Veuillez ajouter au moins 3 photos du véhicule.",
      );
      return;
    }

    setCurrentStep((s) => Math.min(9, s + 1));
  }

  function handlePrev() {
    setCurrentStep((s) => Math.max(1, s - 1));
  }

  function updateStep1<K extends keyof Step1Data>(
    field: K,
    value: Step1Data[K],
  ) {
    setStep1Data((d) => ({ ...d, [field]: value }));
    if (step1Errors[field as keyof Step1Errors]) {
      setStep1Errors((e) => ({ ...e, [field]: undefined }));
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FormLayout
        progress={meta.progress}
        title={meta.title}
        subtitle={meta.subtitle}
        onPrev={handlePrev}
        onNext={handleNext}
        canGoBack={currentStep > 1}
      >
        {currentStep === 1 && (
          <Step1 data={step1Data} errors={step1Errors} onChange={updateStep1} />
        )}
        {currentStep === 2 && (
          <Step2
            data={step2Data}
            onChange={(f, v) => setStep2Data((d) => ({ ...d, [f]: v }))}
          />
        )}
        {currentStep === 3 && (
          <Step3
            data={step3Data}
            onChange={(f, v) => setStep3Data((d) => ({ ...d, [f]: v }))}
          />
        )}
        {currentStep === 4 && (
          <Step4
            data={step4Data}
            onChange={(f, v) => setStep4Data((d) => ({ ...d, [f]: v }))}
          />
        )}
        {currentStep === 5 && (
          <Step5
            data={step5Data}
            onChange={(f, v) => setStep5Data((d) => ({ ...d, [f]: v }))}
          />
        )}
        {currentStep === 6 && (
          <Step6
            data={step6Data}
            onChange={(f, v) => setStep6Data((d) => ({ ...d, [f]: v }))}
          />
        )}
        {currentStep === 7 && (
          <Step7
            data={step7Data}
            onChange={(f, v) => setStep7Data((d) => ({ ...d, [f]: v }))}
          />
        )}
        {currentStep === 8 && (
          <Step8
            data={step8Data}
            departement={step1Data.departement}
            onChange={(f, v) => setStep8Data((d) => ({ ...d, [f]: v }))}
          />
        )}
      </FormLayout>
    </>
  );
}
