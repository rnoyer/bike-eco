import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import type { z } from "zod";

/**
 * Declarative description of a single step. `fields` lists the field names that
 * must be valid before the user can advance — only these are validated on
 * "Suivant", so each step gates on its own inputs.
 */
export interface StepConfig<T extends FieldValues> {
  fields: Path<T>[];
  progress: number;
  title: string;
  subtitle?: string;
}

interface Options<T extends FieldValues> {
  schema: z.ZodType<T>;
  steps: StepConfig<T>[];
  defaultValues: DefaultValues<T>;
  onSubmit: (values: T) => void | Promise<void>;
}

export interface StepForm<T extends FieldValues> {
  form: UseFormReturn<T>;
  step: number;
  isFirst: boolean;
  isLast: boolean;
  meta: StepConfig<T>;
  /** Validates the current step, then advances or submits on the last step. */
  next: () => Promise<void>;
  prev: () => void;
}

/**
 * Drives any multi-step form: react-hook-form for state + Zod validation,
 * plus a step cursor. Validation runs on blur and on "Suivant" (per-step) and
 * on submit (full schema) — never on every keystroke.
 */
export function useStepForm<T extends FieldValues>({
  schema,
  steps,
  defaultValues,
  onSubmit,
}: Options<T>): StepForm<T> {
  const form = useForm<T>({
    // zodResolver's overloads constrain the schema's input to FieldValues,
    // which a generic z.ZodType<T> can't prove; the casts bridge the generics.
    resolver: zodResolver(schema as never) as Resolver<T>,
    mode: "onBlur",
    defaultValues,
  });
  const [step, setStep] = useState(0);

  const next = useCallback(async () => {
    const valid = await form.trigger(steps[step].fields);
    if (!valid) return;
    if (step === steps.length - 1) {
      await form.handleSubmit(onSubmit)();
      return;
    }
    setStep((s) => s + 1);
  }, [form, step, steps, onSubmit]);

  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  return {
    form,
    step,
    isFirst: step === 0,
    isLast: step === steps.length - 1,
    meta: steps[step],
    next,
    prev,
  };
}
