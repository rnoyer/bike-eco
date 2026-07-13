import { Stack, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Alert } from "react-native";
import { FormProvider } from "react-hook-form";

import FormConfirmation from "@/components/form/FormConfirmation";
import FormLayout from "@/components/form/FormLayout";
import {
  B2B_COMPANY_REGISTRATION_DEFAULTS,
  b2bCompanyRegistrationSchema,
  type B2bCompanyRegistrationForm,
} from "@/features/b2b-registration/schema";
import { B2B_COMPANY_REGISTRATION_STEPS } from "@/features/b2b-registration/steps";
import { submitCompanyRegistration } from "@/features/b2b-registration/submit";
import { useStepForm } from "@/lib/forms/useStepForm";

export default function RegisterScreen() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);

  const { form, step, isFirst, isLast, meta, next, prev } =
    useStepForm<B2bCompanyRegistrationForm>({
      schema: b2bCompanyRegistrationSchema,
      steps: B2B_COMPANY_REGISTRATION_STEPS,
      defaultValues: B2B_COMPANY_REGISTRATION_DEFAULTS,
      onSubmit: async (values) => {
        if (submitting.current) return;
        submitting.current = true;
        try {
          await submitCompanyRegistration(values);
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

  const goHome = () => router.replace("/");

  function handlePrev() {
    if (isFirst) {
      if (router.canGoBack()) router.back();
      else goHome();
      return;
    }
    prev();
  }

  if (submitted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <FormConfirmation
          title="Demande d'inscription envoyée !"
          message="Votre inscription est prise en compte. Un email de confirmation vous sera envoyé lorsque votre compte sera validé par notre équipe. Vous pourrez ensuite commencer à utiliser l'application pour vendre vos véhicules."
          buttonLabel="Retour à l'accueil"
          onDone={goHome}
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
          {B2B_COMPANY_REGISTRATION_STEPS[step].render()}
        </FormLayout>
      </FormProvider>
    </>
  );
}
