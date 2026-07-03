import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { FormProvider } from "react-hook-form";

import FormConfirmation from "@/components/form/FormConfirmation";
import FormLayout from "@/components/form/FormLayout";
import {
  B2B_SUBMISSION_DEFAULTS,
  b2bSubmissionSchema,
  type B2bSubmissionForm,
} from "@/features/b2b-submission/schema";
import { B2B_SUBMISSION_STEPS } from "@/features/b2b-submission/steps";
import { submitB2bSubmission } from "@/features/b2b-submission/submit";
import { useStepForm } from "@/lib/forms/useStepForm";

export default function B2bVehiculeSubmission() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);

  const { form, step, isFirst, isLast, meta, next, prev } =
    useStepForm<B2bSubmissionForm>({
      schema: b2bSubmissionSchema,
      steps: B2B_SUBMISSION_STEPS,
      defaultValues: B2B_SUBMISSION_DEFAULTS,
      onSubmit: async (values) => {
        if (submitting.current) return;
        submitting.current = true;
        try {
          await submitB2bSubmission(values);
          setSubmitted(true);
        } catch (err) {
          Alert.alert(
            "Envoi impossible",
            err instanceof Error ? err.message : "Veuillez réessayer."
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
          message="Un email récapitulatif va vous parvenir. Vous serez recontacté très prochainement par notre équipe."
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
