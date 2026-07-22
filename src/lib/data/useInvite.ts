import { useCallback } from "react";

/**
 * STUB — colleague invitations need a Cloud Function to create the Auth user and
 * set its claims, which is slice 4. Kept as a hook so the call site does not
 * change when it lands.
 */
export function useInvite() {
  const invite = useCallback(async (email: string) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (__DEV__) console.log("[stub] invite", { email });
  }, []);

  return { invite };
}
