import { Stack, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useRef, useState } from "react";
import { FormProvider } from "react-hook-form";
import { Alert } from "react-native";

import FormConfirmation from "@/components/form/FormConfirmation";
import FormLayout from "@/components/form/FormLayout";
import {
  B2B_COMPANY_REGISTRATION_DEFAULTS,
  b2bCompanyRegistrationSchema,
  type B2bCompanyRegistrationForm,
} from "@/features/b2b-registration/schema";
import { B2B_COMPANY_REGISTRATION_STEPS } from "@/features/b2b-registration/steps";
import { submitCompanyRegistration } from "@/features/b2b-registration/submit";
import { GoogleAuthProvider } from "@/features/registration/googleAuth";
import { callRegisterCompany } from "@/lib/data/registration";
import { useStepForm } from "@/lib/forms/useStepForm";
import { auth } from "../../../firebaseConfig";

export default function RegisterScreen() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const submitting = useRef(false);
  const usedGoogle = useRef(false);

  const { form, step, isFirst, isLast, meta, next, prev } =
    useStepForm<B2bCompanyRegistrationForm>({
      schema: b2bCompanyRegistrationSchema,
      steps: B2B_COMPANY_REGISTRATION_STEPS,
      defaultValues: B2B_COMPANY_REGISTRATION_DEFAULTS,
      onSubmit: async (values) => {
        if (submitting.current) return;
        submitting.current = true;
        try {
          if (usedGoogle.current) {
            // Google mode: already signed in during step 2 (AccountFields);
            // the callable sets claims + writes the company/user docs from
            // the existing Firebase Auth identity.
            await callRegisterCompany({
              method: "google",
              siret: values.siret,
              companyName: values.companyName,
              nom: values.nom,
              prenom: values.prenom,
              telephone: values.telephone,
              departement: values.departement,
              ville: values.ville,
            });
          } else {
            // Password mode: creates the Auth user server-side; the client
            // stays signed out — the applicant is pending, not active.
            await submitCompanyRegistration(values);
          }
          setSubmitted(true);
        } catch (err) {
          Alert.alert(
            "Inscription impossible",
            err instanceof Error ? err.message : "Veuillez réessayer.",
          );
        } finally {
          submitting.current = false;
        }
      },
    });

  const goHome = async () => {
    if (auth.currentUser) await signOut(auth);
    router.replace("/");
  };

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
      <GoogleAuthProvider
        value={{
          onGoogleProfile: async () => {
            usedGoogle.current = true;
            await next();
          },
        }}
      >
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
      </GoogleAuthProvider>
    </>
  );
}
