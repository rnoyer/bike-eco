import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { FormProvider } from "react-hook-form";

import FormLayout from "@/components/form/FormLayout";
import {
  B2C_SUBMISSION_DEFAULTS,
  b2cSubmissionSchema,
  type B2cSubmissionForm,
} from "@/features/b2c-submission/schema";
import { B2C_SUBMISSION_STEPS } from "@/features/b2c-submission/steps";
import SubmissionConfirmation from "@/features/b2c-submission/SubmissionConfirmation";
import { useStepForm } from "@/lib/forms/useStepForm";

export default function FormParticuliersScreen() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  const { form, step, isFirst, isLast, meta, next, prev } =
    useStepForm<B2cSubmissionForm>({
      schema: b2cSubmissionSchema,
      steps: B2C_SUBMISSION_STEPS,
      defaultValues: B2C_SUBMISSION_DEFAULTS,
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
          {B2C_SUBMISSION_STEPS[step].render()}
        </FormLayout>
      </FormProvider>
    </>
  );
}
