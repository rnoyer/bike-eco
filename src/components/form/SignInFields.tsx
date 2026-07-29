import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { z } from "zod";

import ControlledField from "@/components/form/ControlledField";
import Button from "@/components/ui/Button";
import { tokens } from "@/theme/tokens";

const schema = z.object({
  email: z.email("Saisissez un email valide"),
  password: z.string().min(1, "Saisissez votre mot de passe"),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  onSubmit: (email: string, password: string) => void;
  onForgotPassword: (email: string) => void;
  /** Set while the sign-in round-trip is in flight: the button spins and stops
   *  accepting taps. Without it "Login" looked idle for the whole call. */
  submitting?: boolean;
  /** Set while the reset email is in flight, so the link can't be tapped twice. */
  forgotDisabled?: boolean;
}

export default function SignInFields({
  onSubmit,
  onForgotPassword,
  submitting = false,
  forgotDisabled = false,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: "", password: "" },
  });

  return (
    <FormProvider {...form}>
      <View style={styles.fields}>
        <ControlledField
          name="email"
          label="Adresse email *"
          placeholder="Votre email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <ControlledField
          name="password"
          label="Mot de passe *"
          placeholder="Mot de passe"
          secureTextEntry
          autoCapitalize="none"
        />
        <Button
          label="Login"
          loading={submitting}
          onPress={form.handleSubmit((v) => onSubmit(v.email, v.password))}
        />
        <Button
          variant="text"
          label="Mot de passe oublié"
          disabled={forgotDisabled}
          onPress={() => onForgotPassword(form.getValues("email"))}
        />
      </View>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.space.md },
});
