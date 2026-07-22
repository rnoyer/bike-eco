import type { UserRole, UserStatus } from "@/lib/firestore/schema";

export type AuthRoute = "loading" | "signin" | "pending" | "b2b" | "backoffice";

/** Pure decision: given auth state, where should the user be? */
export function resolveAuthRoute(state: {
  loading: boolean;
  role: UserRole | null;
  status: UserStatus | null;
}): AuthRoute {
  if (state.loading) return "loading";
  if (!state.role) return "signin";
  if (state.status !== "active") return "pending";
  return state.role === "backoffice" ? "backoffice" : "b2b";
}

/** Top-level segments that are reachable without authentication. */
const PUBLIC_SEGMENTS = new Set(["index", "b2cSubmissionForm"]);

/** The concrete destinations the guard can send the user to. */
export type Redirect =
  | "/(auth)/signin"
  | "/(auth)/pending"
  | "/(b2b)/(tabs)/dashboard"
  | "/(backoffice)/(tabs)/dashboard";

/**
 * Pure navigation decision: given the resolved {@link AuthRoute} and the
 * router's current `segments`, the href to redirect to — or `null` to stay put.
 *
 * Redirects fire whenever the user is not already at their destination group,
 * not only from the auth group: a navigator remount (e.g. after the post-login
 * loading flip) can drop an authenticated user back on `index`, and they must
 * still be pushed to their dashboard from there.
 */
export function redirectFor(
  route: AuthRoute,
  segments: string[],
): Redirect | null {
  const top = segments[0] ?? "index";
  switch (route) {
    case "loading":
      return null;
    case "signin":
      return top === "(auth)" || PUBLIC_SEGMENTS.has(top)
        ? null
        : "/(auth)/signin";
    case "pending":
      return segments[1] === "pending" ? null : "/(auth)/pending";
    case "b2b":
      return top === "(b2b)" ? null : "/(b2b)/(tabs)/dashboard";
    case "backoffice":
      return top === "(backoffice)" ? null : "/(backoffice)/(tabs)/dashboard";
  }
}
