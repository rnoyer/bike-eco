import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { FormProvider } from "react-hook-form";

import FormLayout from "@/components/form/FormLayout";
import {
  B2C_VEHICULE_DEFAULTS,
  b2cVehiculeSchema,
  type B2cVehiculeForm,
} from "@/features/b2c-vehicule/schema";
import { B2C_VEHICULE_STEPS } from "@/features/b2c-vehicule/steps";
import SubmissionConfirmation from "@/features/b2c-vehicule/SubmissionConfirmation";
import { useStepForm } from "@/lib/forms/useStepForm";

export default function FormParticuliersScreen() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  const { form, step, isFirst, isLast, meta, next, prev } =
    useStepForm<B2cVehiculeForm>({
      schema: b2cVehiculeSchema,
      steps: B2C_VEHICULE_STEPS,
      defaultValues: B2C_VEHICULE_DEFAULTS,
      onSubmit: async (_values) => {
        // TODO: submit the dossier to the backend.
        setSubmitted(true);
      },
    });

  function goHome() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  function handlePrev() {
    if (isFirst) {
      goHome();
      return;
    }
    prev();
  }

  if (submitted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SubmissionConfirmation onDone={goHome} />
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
          {B2C_VEHICULE_STEPS[step].render()}
        </FormLayout>
      </FormProvider>
    </>
  );
}
