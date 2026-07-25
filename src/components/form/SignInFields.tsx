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
}

export default function SignInFields({ onSubmit, onForgotPassword }: Props) {
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
          onPress={form.handleSubmit((v) => onSubmit(v.email, v.password))}
        />
        <Button
          variant="text"
          label="Mot de passe oublié"
          onPress={() => onForgotPassword(form.getValues("email"))}
        />
      </View>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.space.md },
});
