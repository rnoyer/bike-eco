import type { ComponentProps } from "react";
import { z } from "zod";

import type ControlledField from "@/components/form/ControlledField";
import { digitsOnly } from "@/lib/forms/transforms";

/** The profile fields "Mon compte" lets the user edit. Email is absent on
 *  purpose: it is the Auth credential, not a profile field. */
export const EDITABLE_PROFILE_FIELDS = ["nom", "prenom", "telephone"] as const;
export type EditableProfileField = (typeof EDITABLE_PROFILE_FIELDS)[number];

/** The props that differ per field, minus the ones the form itself owns. */
type FieldProps = Omit<
  ComponentProps<typeof ControlledField>,
  "name" | "label" | "placeholder"
>;

interface ProfileFieldSpec {
  /** Navbar title of the edit screen, and the info row's label with " : ". */
  title: string;
  /** The `InfoEditableRow` label on "Mon compte". */
  rowLabel: string;
  /** Verbatim from `form-b2b-company-registration.md` — the same field, so the
   *  same copy. */
  label: string;
  placeholder: string;
  input: FieldProps;
  /** Validates the one value this form carries. */
  rule: z.ZodType<string, string>;
}

/**
 * One row per editable field: how it is labelled on "Mon compte", how its input
 * behaves, and what makes it valid.
 *
 * The rules are the registration schemas' rules, not new ones — a value the
 * user could not have registered with must not be reachable through the edit
 * path either. `functions/src/users/schemas.ts` mirrors them server-side.
 */
export const PROFILE_FIELDS: Record<EditableProfileField, ProfileFieldSpec> = {
  nom: {
    title: "Modifier mon nom",
    rowLabel: "Nom",
    label: "Nom *",
    placeholder: "Votre nom",
    input: { autoCapitalize: "words", autoComplete: "family-name" },
    rule: z.string().trim().min(1, "Saisissez votre nom"),
  },
  prenom: {
    title: "Modifier mon prénom",
    rowLabel: "Prénom",
    label: "Prénom *",
    placeholder: "Votre prénom",
    input: { autoCapitalize: "words", autoComplete: "given-name" },
    rule: z.string().trim().min(1, "Saisissez votre prénom"),
  },
  telephone: {
    title: "Modifier mon téléphone",
    rowLabel: "Téléphone",
    label: "Téléphone *",
    placeholder: "Votre numéro de téléphone",
    input: {
      keyboardType: "phone-pad",
      autoComplete: "tel",
      transform: digitsOnly(10),
    },
    rule: z.string().regex(/^\d{10}$/, "Saisissez un numéro à 10 chiffres"),
  },
};

/** Narrows the `?field=` search param. Anything else is not an editable field,
 *  and the screen says so rather than rendering an untitled form. */
export function isEditableProfileField(
  value: string | undefined,
): value is EditableProfileField {
  return (EDITABLE_PROFILE_FIELDS as readonly string[]).includes(value ?? "");
}

/** The one-value schema of a given field's form. Built per field so the error
 *  message is the field's own. */
export function profileFieldSchema(field: EditableProfileField) {
  return z.object({ value: PROFILE_FIELDS[field].rule });
}

export type ProfileFieldForm = { value: string };
