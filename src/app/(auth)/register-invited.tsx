import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider } from "react-hook-form";

import FormConfirmation from "@/components/form/FormConfirmation";
import FormLayout from "@/components/form/FormLayout";
import LegalNotice from "@/components/form/LegalNotice";
import {
  B2B_INVITED_REGISTRATION_DEFAULTS,
  b2bInvitedRegistrationSchema,
  type B2bInvitedRegistrationForm,
} from "@/features/b2b-invited-registration/schema";
import { invitedRegistrationSteps } from "@/features/b2b-invited-registration/steps";
import { submitInvitedRegistration } from "@/features/b2b-invited-registration/submit";
import { GoogleAuthProvider } from "@/features/registration/googleAuth";
import { frenchAuthMessage } from "@/lib/auth/authErrors";
import { useSession } from "@/lib/data/useSession";
import { useStepForm } from "@/lib/forms/useStepForm";
import { alertDialog } from "@/lib/ui/dialog";
import { frenchMessage, useAsyncAction } from "@/lib/ui/useAsyncAction";
import { auth } from "../../../firebaseConfig";

type CompletedInvite = {
  method: "password" | "google";
  email: string;
  password: string;
};

export default function RegisterInvitedScreen() {
  const router = useRouter();
  const { email, code, role, organisationName } = useLocalSearchParams<{
    email?: string;
    code?: string;
    role?: string;
    organisationName?: string;
  }>();
  const [submitted, setSubmitted] = useState(false);
  const usedGoogle = useRef(false);
  const completed = useRef<CompletedInvite | null>(null);
  const { refreshSession } = useSession();

  useEffect(() => {
    // Someone landed here without going through /(auth)/invite-code first
    // (e.g. a bare deep link): there's no code to accept the invite with.
    if (!code) router.replace("/(auth)/invite-code");
  }, [code, router]);

  // The invitation's role shapes the funnel (a back-office invitee also picks
  // their "Région gérée"), so the steps are built, not constant — memoised
  // because `useStepForm` keys its `next` callback on the array identity.
  const isBackoffice = role === "backoffice";
  const steps = useMemo(
    () => invitedRegistrationSteps(isBackoffice),
    [isBackoffice],
  );

  const { form, step, isFirst, isLast, meta, next, prev, submitting } =
    useStepForm<B2bInvitedRegistrationForm>({
      schema: b2bInvitedRegistrationSchema,
      steps,
      defaultValues: {
        ...B2B_INVITED_REGISTRATION_DEFAULTS,
        email: email ?? "",
      },
      onSubmit: async (values) => {
        if (!code) {
          alertDialog(
            "Code d'invitation manquant",
            "Veuillez saisir à nouveau votre code d'invitation.",
          );
          router.replace("/(auth)/invite-code");
          return;
        }
        try {
          if (usedGoogle.current) {
            // Google mode: already signed in during step 1 (AccountFields); the
            // callable validates the invite + sets claims from that identity.
            await submitInvitedRegistration({ ...values, code }, "google");
            completed.current = {
              method: "google",
              email: values.email,
              password: values.password,
            };
          } else {
            // Password mode: creates the ACTIVE Auth user server-side; the client
            // stays signed out until "Aller à l'accueil" (below).
            await submitInvitedRegistration({ ...values, code });
            completed.current = {
              method: "password",
              email: values.email,
              password: values.password,
            };
          }
          setSubmitted(true);
        } catch (err) {
          alertDialog("Inscription impossible", frenchMessage(err));
        }
      },
    });

  // "Aller à l'accueil" is not a navigation: it signs the user in (password
  // mode) or force-refreshes the token and re-reads the profile (Google mode)
  // before it routes. Both are round-trips the button has to show.
  const goingToDashboard = useAsyncAction(
    async () => {
      const c = completed.current;
      if (c?.method === "password") {
        await signInWithEmailAndPassword(auth, c.email, c.password);
      } else {
        await refreshSession();
      }
      router.replace(
        role === "backoffice"
          ? "/(backoffice)/(tabs)/dashboard"
          : "/(b2b)/(tabs)/dashboard",
      );
    },
    {
      mapError: frenchAuthMessage,
      onError: (message) => alertDialog("Connexion impossible", message),
    },
  );

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
          onDone={() => void goingToDashboard.run()}
          busy={goingToDashboard.pending}
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
            subtitle={
              step === 0 && organisationName
                ? `Vous rejoignez ${organisationName}.`
                : meta.subtitle
            }
            onPrev={handlePrev}
            onNext={next}
            nextLabel={isLast ? "S'inscrire" : "Suivant"}
            footer={isLast ? <LegalNotice action="S'inscrire" /> : null}
            busy={submitting}
          >
            {steps[step].render()}
          </FormLayout>
        </FormProvider>
      </GoogleAuthProvider>
    </>
  );
}
