import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

import ControlledField from "@/components/form/ControlledField";
import FormLayout from "@/components/form/FormLayout";
import { callResolveInvite } from "@/lib/data/registration";

const inviteCodeSchema = z.object({
  code: z.string().trim().length(6, "Saisissez un code à 6 caractères"),
});
type InviteCodeForm = z.infer<typeof inviteCodeSchema>;

/** Entry point for invited team members: resolve the invite code to the invitation's
 *  email, then hand both off to the invited-registration funnel via route params. */
export default function InviteCodeScreen() {
  const router = useRouter();
  const submitting = useRef(false);

  const form = useForm<InviteCodeForm>({
    resolver: zodResolver(inviteCodeSchema),
    mode: "onBlur",
    defaultValues: { code: "" },
  });

  const handleResolve = useCallback(
    async (values: InviteCodeForm) => {
      if (submitting.current) return;
      submitting.current = true;
      try {
        const { email } = await callResolveInvite(values.code);
        router.push({
          pathname: "/(auth)/register-invited",
          params: { code: values.code, email },
        });
      } catch (err) {
        Alert.alert(
          "Code d'invitation",
          err instanceof Error ? err.message : "Veuillez réessayer."
        );
      } finally {
        submitting.current = false;
      }
    },
    [router]
  );

  function handlePrev() {
    if (router.canGoBack()) router.back();
    else router.replace("/(auth)/signin");
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <FormProvider {...form}>
        <FormLayout
          progress={100}
          title="Code d'invitation"
          subtitle="Saisissez le code à 6 caractères reçu par email pour rejoindre votre entreprise."
          onPrev={handlePrev}
          onNext={() => void form.handleSubmit(handleResolve)()}
          nextLabel="Continuer"
        >
          <ControlledField
            name="code"
            label="Code d'invitation *"
            placeholder="Code à 6 caractères"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            transform={(text) => text.toUpperCase().slice(0, 6)}
          />
        </FormLayout>
      </FormProvider>
    </>
  );
}
