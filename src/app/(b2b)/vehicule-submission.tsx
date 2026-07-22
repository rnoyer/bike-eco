import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { FormProvider } from "react-hook-form";
import { Alert } from "react-native";

import FormConfirmation from "@/components/form/FormConfirmation";
import FormLayout from "@/components/form/FormLayout";
import {
  B2B_SUBMISSION_DEFAULTS,
  b2bSubmissionSchema,
  type B2bSubmissionForm,
} from "@/features/b2b-submission/schema";
import { B2B_SUBMISSION_STEPS } from "@/features/b2b-submission/steps";
import { submitB2bSubmission } from "@/features/b2b-submission/submit";
import { useSession } from "@/lib/data/useSession";
import { useStepForm } from "@/lib/forms/useStepForm";

export default function B2bVehiculeSubmission() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const { user } = useSession();

  const { form, step, isFirst, isLast, meta, next, prev } =
    useStepForm<B2bSubmissionForm>({
      schema: b2bSubmissionSchema,
      steps: B2B_SUBMISSION_STEPS,
      defaultValues: B2B_SUBMISSION_DEFAULTS,
      onSubmit: async (values) => {
        if (submitting.current) return;
        submitting.current = true;
        try {
          if (!user) throw new Error("Votre session a expiré. Reconnectez-vous.");
          await submitB2bSubmission(values, user);
          setSubmitted(true);
        } catch (err) {
          Alert.alert(
            "Envoi impossible",
            err instanceof Error ? err.message : "Veuillez réessayer.",
          );
        } finally {
          submitting.current = false;
        }
      },
    });

  const goToDashboard = () => router.replace("/(b2b)/(tabs)/dashboard");

  function handlePrev() {
    if (isFirst) {
      goToDashboard();
      return;
    }
    prev();
  }

  if (submitted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <FormConfirmation
          title="Demande envoyée !"
          message="Un email récapitulatif va vous parvenir. Vous pouvez suivre l'avancement du dossier et contacter notre équipe, depuis le tableau de bord."
          buttonLabel="Retour au tableau de bord"
          onDone={goToDashboard}
        />
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FormProvider {...form}>
        <FormLayout
          progress={meta.progress}
          title={meta.title}
          subtitle={meta.subtitle}
          onPrev={handlePrev}
          onNext={next}
          nextLabel={isLast ? "Envoyer" : "Suivant"}
        >
          {B2B_SUBMISSION_STEPS[step].render()}
        </FormLayout>
      </FormProvider>
    </>
  );
}
