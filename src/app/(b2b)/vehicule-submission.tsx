import { Stack, useRouter } from "expo-router";
import { useState } from "react";
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
import { useSession } from "@/lib/data/useSession";
import { useStepForm } from "@/lib/forms/useStepForm";
import { alertDialog } from "@/lib/ui/dialog";
import { frenchMessage } from "@/lib/ui/useAsyncAction";

export default function B2bVehiculeSubmission() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const { user } = useSession();

  // The longest wait in the b2b app: a thumbnail render, a forced-server
  // reachability probe and one upload per photo, all sequential.
  const { form, step, isFirst, isLast, meta, next, prev, submitting } =
    useStepForm<B2bSubmissionForm>({
      schema: b2bSubmissionSchema,
      steps: B2B_SUBMISSION_STEPS,
      defaultValues: B2B_SUBMISSION_DEFAULTS,
      onSubmit: async (values) => {
        try {
          if (!user)
            throw new Error("Votre session a expiré. Reconnectez-vous.");
          await submitB2bSubmission(values, user);
          setSubmitted(true);
        } catch (err) {
          alertDialog("Envoi impossible", frenchMessage(err));
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
          message="Retournez sur le tableau de bord pour consulter l'avancement de ce dossier."
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
          busy={submitting}
        >
          {B2B_SUBMISSION_STEPS[step].render()}
        </FormLayout>
      </FormProvider>
    </>
  );
}
