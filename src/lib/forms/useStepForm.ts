import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useRef, useState } from "react";
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
  /** True while the last step's `onSubmit` is in flight. Drive `FormLayout`'s
   *  `busy` with it so "Envoyer" spins instead of sitting there looking idle. */
  submitting: boolean;
  /** Validates the current step, then advances or submits on the last step.
   *  Re-entrant calls are dropped while one is still running. */
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

  // Read unconditionally, during render: `formState` is a Proxy and only
  // tracks the fields actually read before a render, so destructuring here is
  // what subscribes the caller to submit-state changes. Reading it lazily
  // inside `next` would never re-render the button.
  const { isSubmitting } = form.formState;

  // ...and that Proxy value is a render snapshot, which is exactly why it
  // cannot also serve as the re-entry guard: a second tap in the same tick
  // still closes over `false`. The ref is synchronous and wraps the whole of
  // `next`, including the per-step `trigger` await — without it a fast
  // double-tap on "Suivant" advances two steps.
  const running = useRef(false);

  const next = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const valid = await form.trigger(steps[step].fields);
      if (!valid) return;
      if (step === steps.length - 1) {
        await form.handleSubmit(onSubmit)();
        return;
      }
      setStep((s) => s + 1);
    } finally {
      running.current = false;
    }
  }, [form, step, steps, onSubmit]);

  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  return {
    form,
    step,
    isFirst: step === 0,
    isLast: step === steps.length - 1,
    meta: steps[step],
    submitting: isSubmitting,
    next,
    prev,
  };
}
