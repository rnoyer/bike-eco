import { useAsyncAction, type AsyncActionOptions } from "@/lib/ui/useAsyncAction";
import { callSendInvite } from "./registration";

/**
 * Invite a colleague by email: the function issues a one-time 1h code and emails it.
 *
 * Composes `useAsyncAction` so the caller gets `pending` for free rather than
 * owning a second mechanism. It had none at all before, so every extra tap on
 * "Envoyer l'invitation" sent the invitee another email.
 *
 * `invite` resolves to `true` on success and `undefined` on failure, so the
 * caller can navigate on success without a try/catch of its own.
 */
export function useInvite(options?: AsyncActionOptions) {
  const { run, pending, error } = useAsyncAction(async (email: string) => {
    await callSendInvite(email);
    return true as const;
  }, options);

  return { invite: run, pending, error };
}
