import type { ComponentProps } from "react";
import { Controller, useFormContext } from "react-hook-form";
import CheckboxGroup from "./CheckboxGroup";

type GroupProps = Omit<
  ComponentProps<typeof CheckboxGroup>,
  "value" | "onChange" | "error"
>;

interface Props extends GroupProps {
  name: string;
}

/** A `CheckboxGroup` wired to react-hook-form by field name. */
export default function ControlledCheckboxGroup({ name, ...rest }: Props) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <CheckboxGroup
          {...rest}
          value={field.value ?? []}
          onChange={field.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
