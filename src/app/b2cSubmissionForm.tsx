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
import { submitB2cSubmission } from "@/features/b2c-submission/submit";
import SubmissionConfirmation from "@/features/b2c-submission/SubmissionConfirmation";
import { useStepForm } from "@/lib/forms/useStepForm";
import { alertDialog } from "@/lib/ui/dialog";
import { frenchMessage } from "@/lib/ui/useAsyncAction";

export default function FormParticuliersScreen() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);

  // Re-entry is guarded inside `useStepForm`, which also surfaces `submitting`
  // so the button can show it — the old `useRef` blocked the double-send but
  // never re-rendered, leaving the app's longest wait with no feedback at all.
  const { form, step, isFirst, isLast, meta, next, prev, submitting } =
    useStepForm<B2cSubmissionForm>({
      schema: b2cSubmissionSchema,
      steps: B2C_SUBMISSION_STEPS,
      defaultValues: B2C_SUBMISSION_DEFAULTS,
      onSubmit: async (values) => {
        try {
          await submitB2cSubmission(values);
          setSubmitted(true);
        } catch (err) {
          alertDialog("Envoi impossible", frenchMessage(err));
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
          busy={submitting}
        >
          {B2C_SUBMISSION_STEPS[step].render()}
        </FormLayout>
      </FormProvider>
    </>
  );
}
