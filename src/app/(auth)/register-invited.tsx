import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { FormProvider } from "react-hook-form";

import FormConfirmation from "@/components/form/FormConfirmation";
import FormLayout from "@/components/form/FormLayout";
import {
  B2B_INVITED_REGISTRATION_DEFAULTS,
  b2bInvitedRegistrationSchema,
  type B2bInvitedRegistrationForm,
} from "@/features/b2b-invited-registration/schema";
import { B2B_INVITED_REGISTRATION_STEPS } from "@/features/b2b-invited-registration/steps";
import { submitInvitedRegistration } from "@/features/b2b-invited-registration/submit";
import { useStepForm } from "@/lib/forms/useStepForm";

export default function RegisterInvitedScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);

  const { form, step, isFirst, isLast, meta, next, prev } =
    useStepForm<B2bInvitedRegistrationForm>({
      schema: b2bInvitedRegistrationSchema,
      steps: B2B_INVITED_REGISTRATION_STEPS,
      defaultValues: { ...B2B_INVITED_REGISTRATION_DEFAULTS, email: email ?? "" },
      onSubmit: async (values) => {
        if (submitting.current) return;
        submitting.current = true;
        try {
          await submitInvitedRegistration(values);
          setSubmitted(true);
        } catch (err) {
          Alert.alert(
            "Inscription impossible",
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
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    prev();
  }

  if (submitted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <FormConfirmation
          title="Votre inscription est terminée !"
          buttonLabel="Aller à l'accueil"
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
          nextLabel={isLast ? "S'inscrire" : "Suivant"}
        >
          {B2B_INVITED_REGISTRATION_STEPS[step].render()}
        </FormLayout>
      </FormProvider>
    </>
  );
}
