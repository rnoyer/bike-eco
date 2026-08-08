import type { UserRole } from "@/lib/firestore/schema";

/**
 * Turn an FCM `data` block into an in-app route.
 *
 * The payload names a *logical* target ("this dossier"), never a route: the
 * same notification is delivered to a b2b user and to the back office, whose
 * dossier screens live in different route groups. Resolving here means the
 * server never has to know which group the recipient belongs to.
 *
 * Every value arrives as a string (FCM data is string-only) from a source
 * outside this process, so each one is validated rather than trusted.
 */
export function resolveRoute(
  data: Record<string, unknown> | undefined,
  role: UserRole,
): string | null {
  if (!data) return null;
  const id = (key: string): string | null => {
    const value = data[key];
    return typeof value === "string" && value !== "" ? value : null;
  };
  const group = role === "backoffice" ? "(backoffice)" : "(b2b)";

  switch (data.kind) {
    case "company": {
      // Only the back office has a companies route.
      const companyId = id("companyId");
      return role === "backoffice" && companyId
        ? `/(backoffice)/companies/${companyId}`
        : null;
    }
    case "dossier": {
      const dossierId = id("dossierId");
      return dossierId ? `/${group}/dossier/${dossierId}` : null;
    }
    case "chat": {
      const dossierId = id("dossierId");
      return dossierId ? `/${group}/dossier/${dossierId}/chat` : null;
    }
    default:
      return null;
  }
}
