import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { StyleSheet, Text, View } from "react-native";

import ControlledField from "@/components/form/ControlledField";
import Button from "@/components/ui/Button";
import {
  PROFILE_FIELDS,
  profileFieldSchema,
  type EditableProfileField,
  type ProfileFieldForm,
} from "@/features/profile/fields";
import { tokens } from "@/theme/tokens";

/** One-step form editing a single profile field, prefilled with its current
 *  value. Which field it is drives the label, the keyboard and the rule — all
 *  of it read from `PROFILE_FIELDS`, so this component has no per-field branch. */
export default function EditProfileFieldForm({
  field,
  initialValue,
  onCancel,
  onSubmit,
  busy = false,
}: {
  field: EditableProfileField;
  initialValue: string;
  onCancel: () => void;
  onSubmit: (value: string) => void;
  /** The update is in flight — "Mettre à jour" spins and both buttons stop
   *  accepting taps. */
  busy?: boolean;
}) {
  const spec = PROFILE_FIELDS[field];
  // Rebuilt only when the field changes: `useForm` reads the resolver on every
  // render, and a new schema object each time is pure churn.
  const schema = useMemo(() => profileFieldSchema(field), [field]);

  const form = useForm<ProfileFieldForm>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: { value: initialValue },
  });

  return (
    <FormProvider {...form}>
      <View style={styles.fields}>
        <ControlledField
          name="value"
          label={spec.label}
          placeholder={spec.placeholder}
          {...spec.input}
        />
        <Text style={styles.note}>* Champs obligatoires</Text>
        <Button
          variant="primary"
          label="Annuler"
          disabled={busy}
          onPress={onCancel}
        />
        {/* `outlined` is this app's secondary style — `Button` has no
            `secondary` variant. */}
        <Button
          variant="outlined"
          label="Mettre à jour"
          loading={busy}
          onPress={form.handleSubmit((v) => onSubmit(v.value))}
        />
      </View>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.space.lg },
  note: { fontSize: 12, color: tokens.colors.muted },
});
