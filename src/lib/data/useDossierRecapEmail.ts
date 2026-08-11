import { call } from "./callable";
import { useAsyncAction, type AsyncActionOptions } from "@/lib/ui/useAsyncAction";

/**
 * Mail the signed-in back-office user a recap of one dossier.
 *
 * Only the id crosses the wire: the callable resolves the recipient from the
 * caller's own token and returns a bare acknowledgement, so the address is
 * never in the client's hands — which is why the confirmation screen says
 * "votre adresse email" rather than naming a mailbox.
 *
 * `call` already maps the failure to French copy, so the default `mapError`
 * is right and callers only pass `onError`.
 */
export function useDossierRecapEmail(options?: AsyncActionOptions) {
  const { run, pending } = useAsyncAction(
    (dossierId: string) =>
      call<{ dossierId: string }, { ok: true }>("sendDossierRecap", {
        dossierId,
      }),
    options,
  );

  return { sendRecap: run, pending };
}
