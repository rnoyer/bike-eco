import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";
import { z } from "zod";

import ControlledField from "@/components/form/ControlledField";
import Button from "@/components/ui/Button";
import { tokens } from "@/theme/tokens";

const schema = z.object({
  email: z.email("Saisissez un email valide"),
});
type FormValues = z.infer<typeof schema>;

export default function AddColleagueForm({
  onSubmit,
  busy = false,
}: {
  onSubmit: (email: string) => void;
  /** The invitation is in flight — the button spins and stops accepting taps. */
  busy?: boolean;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { email: "" },
  });

  return (
    <FormProvider {...form}>
      <View style={styles.fields}>
        <ControlledField
          name="email"
          label="Adresse email de l'invité *"
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Text style={styles.note}>* Champs obligatoires</Text>
        <Button
          label="Envoyer l'invitation"
          loading={busy}
          onPress={form.handleSubmit((v) => onSubmit(v.email))}
        />
      </View>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.space.lg },
  note: { fontSize: 12, color: tokens.colors.muted },
});
