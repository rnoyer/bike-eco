/**
 * Reads the `email` claim out of an Apple identity token.
 *
 * Apple puts the user's email on `AppleAuthenticationCredential` only on the
 * *first* authorization for a given Apple ID; every later sign-in returns null
 * there. The identity token usually still carries the claim, and that is what
 * lets the invited-registration funnel compare the address *before* the
 * credential reaches Firebase — the invariant `googleSignIn.ts` documents.
 *
 * The signature is deliberately **not** verified, and does not need to be: the
 * value is only used to decide whether to abandon a sign-in early. A forged
 * token buys nothing — Firebase still verifies the credential itself, and
 * `acceptInviteCore` still re-checks the address server-side. Treat the result
 * as a hint, never as authorization.
 *
 * Returns null for anything unparseable, including a token whose claim is
 * simply absent — the caller falls back to reading the address off the signed-in
 * user (see `appleSignIn.ios.ts`).
 */
export function appleIdTokenEmail(
  idToken: string | null | undefined,
): string | null {
  if (!idToken) return null;
  const payload = idToken.split(".")[1];
  if (!payload) return null;
  try {
    // base64url → base64, then pad to a multiple of 4 for `atob`.
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    // `atob` yields one character per byte; re-encode as percent escapes so a
    // non-ASCII claim (a name, say) survives as valid UTF-8.
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    const claims = JSON.parse(json) as { email?: unknown };
    return typeof claims.email === "string" && claims.email
      ? claims.email
      : null;
  } catch {
    return null;
  }
}
