import type { UserRole } from "@/lib/firestore/schema";

/**
 * What the second button of the "Supprimer mon compte" modal does. "Annuler" is
 * always the first, always primary, and always just dismisses.
 */
export type DeleteAccountAction =
  /** Delete this account; the organisation carries on without it. */
  | "delete"
  /** Delete this account *and* the company — the caller is its last member. */
  | "deleteWithCompany"
  /** Delete nothing: the organisation still needs this account, and the way out
   *  is on the "Paramètres" tab. */
  | "manage";

export interface DeleteAccountPrompt {
  message: string;
  /** Label of the second button. */
  actionLabel: string;
  action: DeleteAccountAction;
}

export interface DeleteAccountInput {
  role: UserRole;
  isAdmin: boolean;
  /** The *other* members of the organisation — the viewer excluded, which is
   *  exactly what `useColleagues()` returns. */
  others: { isAdmin: boolean }[];
  /** b2b only, and `null` until the company read lands. */
  companyName: string | null;
}

const PLAIN: DeleteAccountPrompt = {
  message:
    "Cette action supprime définitivement votre compte. Vos dossiers et vos " +
    "conversations sont conservés.",
  actionLabel: "Supprimer mon compte",
  action: "delete",
};

/**
 * Which of the three modals "Supprimer mon compte" opens.
 *
 * The two questions are asked in this order — **last member wins over last
 * admin**, because it subsumes it and is the only one of the two the user can
 * act on right now. `deleteMyAccountCore` branches the same way, and must: this
 * decision is read from a live snapshot, so a colleague can be demoted or
 * deleted between the read and the call.
 */
export function deleteAccountPrompt(input: DeleteAccountInput): DeleteAccountPrompt {
  const { role, isAdmin, others, companyName } = input;
  const lastMember = others.length === 0;
  const lastAdmin = isAdmin && !others.some((o) => o.isAdmin);

  if (role === "backoffice") return PLAIN;

  // "l'entreprise Moto Dupont" while the company read is in flight would name
  // nothing, so fall back to the possessive rather than to an empty gap.
  const company = companyName ? `l'entreprise ${companyName}` : "votre entreprise";

  if (lastMember) {
    return {
      message:
        `En supprimant votre compte, vous supprimez également toutes les données ` +
        `relatives à ${company} et aux dossiers que vous avez soumis.\n` +
        `Êtes-vous sur de vouloir supprimer votre compte et l'entreprise ?`,
      actionLabel: "Supprimer mon compte",
      action: "deleteWithCompany",
    };
  }
  if (lastAdmin) {
    return {
      message:
        `Vous êtes le dernier administrateur de ${company}. Veuillez attribuer ` +
        `le rôle Administrateur à un autre vendeur avant de supprimer votre compte`,
      actionLabel: "Gérer mes collaborateurs",
      action: "manage",
    };
  }
  return PLAIN;
}
