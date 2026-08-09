import {
  companyRegisteredContent,
  dossierCreatedContent,
  newMessageContent,
  personFromSenderName,
  priceChangedContent,
  statusChangedContent,
  type NotificationContent,
  type NotificationTarget,
} from "./copy";
import { viewerStatus, type DossierStatus, type Region, type UserRole } from "./labels";

/** The subset of a `users/{uid}` document fan-out needs. */
export interface Recipient {
  uid: string;
  role: UserRole;
  notificationRegion: Region | null;
}

export interface ResolveDeps {
  /** Every *active* back-office user. Filtered by région here, not in the query. */
  backofficeUsers(): Promise<Recipient[]>;
  /** Every *active* member of a company. */
  companyMembers(companyId: string): Promise<Recipient[]>;
  /** uids with a `dossiers/{id}/mutes/{uid}` document. */
  mutedUids(dossierId: string): Promise<string[]>;
}

export type NotificationEvent =
  | {
      kind: "companyRegistered";
      companyId: string;
      companyName: string;
      createdByName: string;
      region: Region;
    }
  | {
      kind: "dossierCreated";
      dossierId: string;
      region: Region;
      companyName: string;
      sellerName: string;
    }
  | {
      kind: "messageCreated";
      dossierId: string;
      region: Region;
      companyId: string;
      senderUid: string;
      senderRole: UserRole;
      /** The stamped "Prénom Nom - Entreprise" form, not the bare person. */
      senderName: string;
      moto: string;
    }
  | {
      kind: "statusChanged";
      dossierId: string;
      region: Region;
      companyId: string;
      actorUid: string;
      moto: string;
      /** Needed to tell who the change is *visible* to — see `resolveDeliveries`. */
      previousStatus: DossierStatus;
      status: DossierStatus;
    }
  | {
      kind: "priceChanged";
      dossierId: string;
      region: Region;
      companyId: string;
      actorUid: string;
      moto: string;
      validatedPrice: number | null;
    };

/** One notification, for one person. */
export interface Delivery {
  uid: string;
  content: NotificationContent;
  target: NotificationTarget;
}

/**
 * A back-office member manages a région (or all of France, `null`). Filtering
 * in memory rather than in the query keeps the `null` case out of Firestore's
 * `in` semantics — and the back-office team is a handful of people.
 */
function inRegion(user: Recipient, region: Region): boolean {
  return user.notificationRegion === null || user.notificationRegion === region;
}

/**
 * The people who care about an existing dossier: the back office that manages
 * its région, plus the dealership that filed it. Callers subtract the actor and
 * the mutes.
 */
async function dossierAudience(
  event: { region: Region; companyId: string },
  deps: ResolveDeps,
): Promise<Recipient[]> {
  const [backoffice, members] = await Promise.all([
    deps.backofficeUsers(),
    deps.companyMembers(event.companyId),
  ]);
  return [...backoffice.filter((u) => inRegion(u, event.region)), ...members];
}

function exclude(users: Recipient[], uids: Set<string>): Recipient[] {
  return users.filter((u) => !uids.has(u.uid));
}

export async function resolveDeliveries(
  event: NotificationEvent,
  deps: ResolveDeps,
): Promise<Delivery[]> {
  switch (event.kind) {
    case "companyRegistered": {
      const target: NotificationTarget = {
        kind: "company",
        companyId: event.companyId,
      };
      const content = companyRegisteredContent(event);
      const users = (await deps.backofficeUsers()).filter((u) =>
        inRegion(u, event.region),
      );
      return users.map((u) => ({ uid: u.uid, content, target }));
    }

    case "dossierCreated": {
      // No mute lookup: the dossier is one write old, so its `mutes`
      // subcollection cannot exist yet.
      const target: NotificationTarget = {
        kind: "dossier",
        dossierId: event.dossierId,
      };
      const content = dossierCreatedContent(event);
      const users = (await deps.backofficeUsers()).filter((u) =>
        inRegion(u, event.region),
      );
      return users.map((u) => ({ uid: u.uid, content, target }));
    }

    case "messageCreated": {
      const target: NotificationTarget = {
        kind: "chat",
        dossierId: event.dossierId,
      };
      const [backoffice, members, muted] = await Promise.all([
        deps.backofficeUsers(),
        // A b2b message is not relayed to the sender's own teammates: the b2b
        // copy is fixed to "de Bike-eco", so it would misattribute a
        // colleague's message to the Bike-eco team.
        event.senderRole === "backoffice"
          ? deps.companyMembers(event.companyId)
          : Promise.resolve<Recipient[]>([]),
        deps.mutedUids(event.dossierId),
      ]);
      const audience = [
        ...backoffice.filter((u) => inRegion(u, event.region)),
        ...members,
      ];
      const skip = new Set([event.senderUid, ...muted]);
      const senderPerson = personFromSenderName(event.senderName);
      return exclude(audience, skip).map((u) => ({
        uid: u.uid,
        content: newMessageContent({
          recipientRole: u.role,
          senderPerson,
          moto: event.moto,
        }),
        target,
      }));
    }

    case "statusChanged":
    case "priceChanged": {
      const target: NotificationTarget = {
        kind: "dossier",
        dossierId: event.dossierId,
      };
      const [audience, muted] = await Promise.all([
        dossierAudience(event, deps),
        deps.mutedUids(event.dossierId),
      ]);
      const skip = new Set([event.actorUid, ...muted]);
      // Per recipient, not once for the audience: the status label is
      // role-dependent (a b2b user never sees "À traiter"). The price copy has
      // no such projection, but building it in the same place keeps the arm
      // shared. `dispatch` groups by the rendered content, so the two status
      // variants become two multicasts and the identical price copy stays one.
      const contentFor = (recipientRole: UserRole): NotificationContent =>
        event.kind === "statusChanged"
          ? statusChangedContent({ ...event, recipientRole })
          : priceChangedContent(event);
      // A status change nobody in that role can see is not an event for them.
      // `viewerStatus` collapses `a_traiter` into `en_cours` for b2b, so moving
      // a dossier between those two is invisible to a dealer: the screen said
      // "En cours" before and says "En cours" after, and a push claiming "Le
      // statut a évolué" contradicts it. Back-office members see the real
      // states, so for them every transition is a change.
      //
      // The projection has to gate delivery and not only copy - fixing the copy
      // alone (which is what `statusChangedContent`'s `recipientRole` does)
      // still sends the dealer a notification about nothing.
      const isVisibleTo = (role: UserRole): boolean =>
        event.kind !== "statusChanged" ||
        viewerStatus(event.previousStatus, role) !==
          viewerStatus(event.status, role);
      return exclude(audience, skip)
        .filter((u) => isVisibleTo(u.role))
        .map((u) => ({
          uid: u.uid,
          content: contentFor(u.role),
          target,
        }));
    }
  }
}
