import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { B2bCompanyRegistrationForm } from "./schema";

/**
 * Decide what the user's "Département" (step 3) should become given the company
 * "Département" (step 1). Returns the value to write, or `null` to leave it.
 *
 * The user field mirrors the company field until the registrant hand-edits it
 * (`userEdited`) — so changing the company département on step 1 re-syncs the
 * still-untouched user field, while a deliberate override is preserved.
 * Emptiness is NOT a usable proxy for "untouched": the field is non-empty the
 * moment it is auto-filled, which previously froze it on the first value.
 */
export function nextDepartement(
  companyDept: string,
  currentDepartement: string,
  userEdited: boolean,
): string | null {
  if (!companyDept) return null; // nothing to pre-fill from yet
  if (userEdited) return null; // the registrant chose their own — leave it
  if (currentDepartement === companyDept) return null; // already in sync
  return companyDept;
}

/**
 * Pre-fills the user's "Département" (step 3) from the company "Département"
 * (step 1) as it changes, while leaving the user free to override it.
 */
export function useDepartementPrefill(
  form: UseFormReturn<B2bCompanyRegistrationForm>,
): void {
  const companyDept = form.watch("companyDepartement");
  useEffect(() => {
    const next = nextDepartement(
      companyDept ?? "",
      form.getValues("departement") ?? "",
      form.getFieldState("departement").isDirty,
    );
    if (next !== null) form.setValue("departement", next, { shouldDirty: false });
  }, [companyDept, form]);
}
