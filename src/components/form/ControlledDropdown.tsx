import type { ComponentProps } from "react";
import { Controller, useFormContext } from "react-hook-form";
import Dropdown from "./Dropdown";

type DropdownProps = Omit<
  ComponentProps<typeof Dropdown>,
  "value" | "onChange" | "error"
>;

interface Props extends DropdownProps {
  name: string;
}

/** A `Dropdown` wired to react-hook-form by field name. */
export default function ControlledDropdown({ name, ...rest }: Props) {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Dropdown
          {...rest}
          value={field.value ?? null}
          onChange={field.onChange}
          error={fieldState.error?.message}
        />
      )}
    />
  );
}
