import type { SessionUser } from "@/lib/auth/session";

/**
 * The denormalized `Message.senderName`: "[prénom nom] - [société]" for a dealer,
 * "[prénom nom] - Bike-eco" for the team (page-chat.md).
 */
export function formatSenderName(
  user: SessionUser,
  companyName: string,
): string {
  const person = `${user.prenom} ${user.nom}`.trim();
  return user.role === "backoffice"
    ? `${person} - Bike-eco`
    : `${person} - ${companyName}`;
}
