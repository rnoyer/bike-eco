import { useCallback, useEffect, useRef, useState } from "react";

/** Fallback when the thrown value carries no usable French copy. */
const GENERIC = "Une erreur est survenue. Veuillez réessayer.";

/**
 * Default error mapping: the app's data layer already throws French `Error`s
 * (`frenchError`, `mapDataError`), so its message is the message to show.
 * Anything else — a raw Firebase error, a string, `undefined` — falls back.
 */
export function frenchMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : GENERIC;
}

export interface AsyncActionOptions {
  /**
   * Turns whatever the action threw into French copy. Defaults to
   * `frenchMessage`; auth call sites pass `frenchAuthMessage`, which
   * additionally understands `auth/*` codes.
   */
  mapError?: (error: unknown) => string;
  /** Side effect on failure — usually `alertDialog`. `error` is also returned. */
  onError?: (message: string) => void;
}

export interface AsyncAction<A extends unknown[], R> {
  /** Runs the action unless one is already in flight. Resolves to the action's
   *  result, or `undefined` if it was skipped or threw. */
  run: (...args: A) => Promise<R | undefined>;
  pending: boolean;
  error: string | null;
  /** Clears `error` — e.g. when the user edits the input that caused it. */
  reset: () => void;
}

/**
 * The one way to run a user-initiated async action.
 *
 * Owns the three things every write in this app needs and most call sites used
 * to hand-roll (or forget): a re-entry guard, a `pending` flag the UI can
 * render, and a mapped French error.
 *
 * The guard is a ref, not `pending`: state only lands on the next render, so a
 * second tap in the same tick would sail past a state-only check — which is why
 * the funnels used a `useRef` in the first place. Keeping both means the double
 * send is blocked *and* the button re-renders.
 *
 * ```ts
 * const invite = useAsyncAction(callSendInvite, { onError: (m) => alertDialog("Erreur", m) });
 * <Button label="Envoyer" loading={invite.pending} onPress={() => void invite.run(email)} />
 * ```
 */
export function useAsyncAction<A extends unknown[], R>(
  action: (...args: A) => Promise<R>,
  options: AsyncActionOptions = {},
): AsyncAction<A, R> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  // Actions are usually inline arrows, so a fresh identity every render. `run`
  // reads the latest through a ref so its own identity stays stable — a
  // changing `run` would re-trigger any effect that depends on it. Assigned in
  // an effect, not during render: a render-phase ref write is not safe under
  // concurrent rendering, and `run` is only ever called from an event handler,
  // which is always after effects have flushed.
  const latest = useRef({ action, options });
  useEffect(() => {
    latest.current = { action, options };
  });

  // Most of these actions navigate away on success (`router.replace`), so the
  // component is often gone by the time the `finally` runs.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    if (mounted.current) {
      setPending(true);
      setError(null);
    }
    try {
      return await latest.current.action(...args);
    } catch (e) {
      const { mapError = frenchMessage, onError } = latest.current.options;
      const message = mapError(e);
      if (mounted.current) setError(message);
      onError?.(message);
      return undefined;
    } finally {
      running.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);

  return { run, pending, error, reset };
}
