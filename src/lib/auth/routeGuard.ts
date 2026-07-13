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
