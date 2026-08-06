import { Stack, useRouter } from "expo-router";
import { signOut } from "firebase/auth";
import { useRef, useState } from "react";
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
import { GoogleAuthProvider } from "@/features/registration/googleAuth";
import { frenchAuthMessage } from "@/lib/auth/authErrors";
import { callRegisterCompany } from "@/lib/data/registration";
import { useStepForm } from "@/lib/forms/useStepForm";
import { alertDialog } from "@/lib/ui/dialog";
import { frenchMessage, useAsyncAction } from "@/lib/ui/useAsyncAction";
import { auth } from "../../../firebaseConfig";

export default function RegisterScreen() {
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const usedGoogle = useRef(false);

  const { form, step, isFirst, isLast, meta, next, prev, submitting } =
    useStepForm<B2bCompanyRegistrationForm>({
      schema: b2bCompanyRegistrationSchema,
      steps: B2B_COMPANY_REGISTRATION_STEPS,
      defaultValues: B2B_COMPANY_REGISTRATION_DEFAULTS,
      onSubmit: async (values) => {
        try {
          if (usedGoogle.current) {
            // Google mode: already signed in during step 2 (AccountFields);
            // the callable sets claims + writes the company/user docs from
            // the existing Firebase Auth identity.
            await callRegisterCompany({
              method: "google",
              siret: values.siret,
              tva: values.tva || undefined,
              companyName: values.companyName,
              companyDepartement: values.companyDepartement,
              companyVille: values.companyVille,
              nom: values.nom,
              prenom: values.prenom,
              telephone: values.telephone,
            });
          } else {
            // Password mode: creates the Auth user server-side; the client
            // stays signed out — the applicant is pending, not active.
            await submitCompanyRegistration(values);
          }
          setSubmitted(true);
        } catch (err) {
          alertDialog("Inscription impossible", frenchMessage(err));
        }
      },
    });

  // Signing out is a network round-trip in the Google path, and it is what
  // "Retour à l'accueil" waits on before navigating.
  const goingHome = useAsyncAction(
    async () => {
      if (auth.currentUser) await signOut(auth);
      router.replace("/");
    },
    {
      mapError: frenchAuthMessage,
      onError: (message) => alertDialog("Déconnexion impossible", message),
    },
  );

  function handlePrev() {
    if (isFirst) {
      if (router.canGoBack()) router.back();
      else void goingHome.run();
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
          onDone={() => void goingHome.run()}
          busy={goingHome.pending}
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
            // "Précédent" on step 1 signs out before it navigates, so the row
            // has to lock for that round-trip too.
            busy={submitting || goingHome.pending}
          >
            {B2B_COMPANY_REGISTRATION_STEPS[step].render()}
          </FormLayout>
        </FormProvider>
      </GoogleAuthProvider>
    </>
  );
}
