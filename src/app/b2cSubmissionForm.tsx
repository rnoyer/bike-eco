import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { FormProvider } from "react-hook-form";

import FormLayout from "@/components/form/FormLayout";
import {
  B2C_SUBMISSION_DEFAULTS,
  b2cSubmissionSchema,
  type B2cSubmissionForm,
} from "@/features/b2c-submission/schema";
import { B2C_SUBMISSION_STEPS } from "@/features/b2c-submission/steps";
import { submitB2cSubmission } from "@/features/b2c-submission/submit";
import SubmissionConfirmation from "@/features/b2c-submission/SubmissionConfirmation";
import { useStepForm } from "@/lib/forms/useStepForm";

export default function FormParticuliersScreen() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  // Guards against a double-send if the submit button is tapped twice.
  const submitting = useRef(false);

  const { form, step, isFirst, isLast, meta, next, prev } =
    useStepForm<B2cSubmissionForm>({
      schema: b2cSubmissionSchema,
      steps: B2C_SUBMISSION_STEPS,
      defaultValues: B2C_SUBMISSION_DEFAULTS,
      onSubmit: async (values) => {
        if (submitting.current) return;
        submitting.current = true;
        try {
          await submitB2cSubmission(values);
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
