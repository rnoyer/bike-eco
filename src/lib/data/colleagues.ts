import type { AppUser, UserRole } from "@/lib/firestore/schema";

/** Scope of a "Mes collaborateurs" list: one company, or the back-office team. */
export type ColleagueScope =
  | { kind: "company"; companyId: string }
  | { kind: "backoffice" };

/** French label for the card subtitle and the info list's "Rôle" row. */
export function roleLabel(user: Pick<AppUser, "role" | "isAdmin">): string {
  if (user.isAdmin) return "Administrateur";
  return user.role === "backoffice" ? "Membre" : "Vendeur";
}

/** Nom then prénom, using French collation so "Émile" sorts next to "Emile". */
export function sortByName<T extends { nom: string; prenom: string }>(users: T[]): T[] {
  return [...users].sort(
    (a, b) =>
      a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }) ||
      a.prenom.localeCompare(b.prenom, "fr", { sensitivity: "base" }),
  );
}

/** A b2b user's colleagues are their company; a back-office user's are the team. */
export function colleagueScope(
  session: { role: UserRole; companyId: string | null } | null,
): ColleagueScope | null {
  if (!session) return null;
  if (session.role === "backoffice") return { kind: "backoffice" };
  return session.companyId ? { kind: "company", companyId: session.companyId } : null;
}
