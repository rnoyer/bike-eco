import { zodResolver } from "@hookform/resolvers/zod";
import { Stack, useRouter } from "expo-router";
import { FormProvider, useForm } from "react-hook-form";
import { z } from "zod";

import ControlledField from "@/components/form/ControlledField";
import FormLayout from "@/components/form/FormLayout";
import { callResolveInvite } from "@/lib/data/registration";
import { alertDialog } from "@/lib/ui/dialog";
import { useAsyncAction } from "@/lib/ui/useAsyncAction";

const inviteCodeSchema = z.object({
  code: z.string().trim().length(6, "Saisissez un code à 6 caractères"),
});
type InviteCodeForm = z.infer<typeof inviteCodeSchema>;

/** Entry point for invited team members: resolve the invite code to the invitation's
 *  email, then hand both off to the invited-registration funnel via route params. */
export default function InviteCodeScreen() {
  const router = useRouter();

  const form = useForm<InviteCodeForm>({
    resolver: zodResolver(inviteCodeSchema),
    mode: "onBlur",
    defaultValues: { code: "" },
  });

  // Single-step, so there is no `useStepForm` to own the pending state.
  const resolving = useAsyncAction(
    async (code: string) => {
      const { email, role, organisationName } = await callResolveInvite(code);
      router.push({
        pathname: "/(auth)/register-invited",
        params: { code, email, role, organisationName },
      });
    },
    { onError: (message) => alertDialog("Code d'invitation", message) },
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
          subtitle="Saisissez le code à 6 caractères reçu par email pour rejoindre votre équipe."
          onPrev={handlePrev}
          onNext={() =>
            void form.handleSubmit((v) => resolving.run(v.code))()
          }
          nextLabel="Continuer"
          busy={resolving.pending}
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
