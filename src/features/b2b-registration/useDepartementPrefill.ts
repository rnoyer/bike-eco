import { useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { B2bCompanyRegistrationForm } from "./schema";

/**
 * Decide what the user's "Département" (step 3) should become given the company
 * "Département" (step 1). Returns the value to write, or `null` to leave it.
 *
 * The step-3 field is a disabled mirror of step 1, so it always tracks the
 * company département — including when the registrant goes back and changes it.
 * (An earlier "only fill while empty" rule froze the field on its first value.)
 */
export function nextDepartement(
  companyDept: string,
  currentDepartement: string,
): string | null {
  if (!companyDept) return null; // nothing to mirror yet
  if (currentDepartement === companyDept) return null; // already in sync
  return companyDept;
}

/**
 * Keeps the user's "Département" (step 3) mirroring the company "Département"
 * (step 1) as it changes. The step-3 field is rendered disabled, so this is the
 * only writer of that value.
 */
export function useDepartementPrefill(
  form: UseFormReturn<B2bCompanyRegistrationForm>,
): void {
  const companyDept = form.watch("companyDepartement");
  useEffect(() => {
    const next = nextDepartement(
      companyDept ?? "",
      form.getValues("departement") ?? "",
    );
    if (next !== null) form.setValue("departement", next, { shouldValidate: true });
  }, [companyDept, form]);
}
