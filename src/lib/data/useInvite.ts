import { useCallback } from "react";
import { callSendInvite } from "./registration";

/** Invite a colleague by email: the function issues a one-time 1h code and emails it. */
export function useInvite() {
  const invite = useCallback((email: string) => callSendInvite(email), []);
  return { invite };
}
