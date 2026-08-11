import {
  STATUS_LABELS,
  euros,
  viewerStatus,
  type DossierStatus,
  type UserRole,
} from "../labels";

/** Line 1 becomes the FCM `title`; the rest become the `\n`-joined `body`. */
export interface NotificationContent {
  title: string;
  body: string;
}

/** Where a tap should land. Serialized into the FCM `data` block. */
export type NotificationTarget =
  | { kind: "company"; companyId: string }
  | { kind: "dossier"; dossierId: string }
  | { kind: "chat"; dossierId: string };

const lines = (title: string, ...rest: string[]): NotificationContent => ({
  title,
  body: rest.join("\n"),
});

/** "Yamaha MT-07", or the fallback when the dealer filled in neither field. */
export function motoLabel(v: { marque?: string; modele?: string }): string {
  return [v.marque, v.modele].filter(Boolean).join(" ") || "Moto non renseignée";
}

/**
 * `Message.senderName` is stamped as "Prénom Nom - Entreprise" (or
 * "- Bike-eco") by the sendMessage callable. The notification wants only the
 * person, and reading `users/{senderId}` instead would break for a deleted
 * colleague — the denormalized name is the only copy guaranteed to survive.
 *
 * Splits on the LAST " - " because a company name may contain one.
 */
export function personFromSenderName(senderName: string): string {
  const at = senderName.lastIndexOf(" - ");
  return at === -1 ? senderName : senderName.slice(0, at);
}

export function companyRegisteredContent(input: {
  companyName: string;
  createdByName: string;
}): NotificationContent {
  return lines(
    "1 nouvelle entreprise s'est inscrite",
    input.companyName,
    input.createdByName,
  );
}

export function dossierCreatedContent(input: {
  companyName: string;
  sellerName: string;
}): NotificationContent {
  return lines(
    "Une nouvelle proposition d'achat vient d'être publié.",
    `Entreprise ${input.companyName}`,
    `Vendeur : ${input.sellerName}`,
  );
}

/**
 * A b2b recipient is only ever notified of a back-office message (see
 * `resolveDeliveries`), which is why "de Bike-eco" can be unconditional here.
 */
export function newMessageContent(input: {
  recipientRole: UserRole;
  senderPerson: string;
  moto: string;
}): NotificationContent {
  const from = input.recipientRole === "b2b" ? "Bike-eco" : input.senderPerson;
  return lines(`1 nouveau message de ${from}`, `Pour la ${input.moto}`);
}

/**
 * Role-dependent, like {@link newMessageContent}: the label is projected
 * through `viewerStatus` so a b2b recipient is never told "À traiter", a state
 * the app deliberately never shows them (their dossier screen says "En cours").
 * The two variants split into separate multicasts on their own — `dispatch`
 * groups by the rendered content.
 */
export function statusChangedContent(input: {
  recipientRole: UserRole;
  moto: string;
  status: DossierStatus;
}): NotificationContent {
  const status = viewerStatus(input.status, input.recipientRole);
  return lines(
    `Le statut de la ${input.moto} a évolué`,
    `Nouveau statut: ${STATUS_LABELS[status]}`,
  );
}

export function priceChangedContent(input: {
  moto: string;
  validatedPrice: number | null;
}): NotificationContent {
  return lines(
    `Le prix validé de la ${input.moto} a évolué`,
    `Prix validé: ${euros(input.validatedPrice)}`,
  );
}
