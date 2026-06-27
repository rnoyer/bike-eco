import type { ComponentProps } from "react";
import { Controller, useFormContext } from "react-hook-form";
import FormField from "./FormField";

type FieldProps = Omit<
  ComponentProps<typeof FormField>,
  "value" | "onChangeText" | "onBlur" | "error"
>;

interface Props extends FieldProps {
  name: string;
  /** Sanitises raw input before it is stored (e.g. strip non-digits). */
  transform?: (text: string) => string;
}

/** A text/number `FormField` wired to react-hook-form by field name. */
export default function ControlledField({ name, transform, ...rest }: Props) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField
          {...rest}
          value={field.value ?? ""}
          onChangeText={(text) =>
            field.onChange(transform ? transform(text) : text)
          }
          onBlur={field.onBlur}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
