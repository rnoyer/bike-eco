import { expect, test } from "@jest/globals";
import {
  resolveDeliveries,
  type NotificationEvent,
  type Recipient,
  type ResolveDeps,
} from "./core";

const bo = (uid: string, region: Recipient["notificationRegion"]): Recipient => ({
  uid,
  role: "backoffice",
  notificationRegion: region,
});

const dealer = (uid: string): Recipient => ({
  uid,
  role: "b2b",
  notificationRegion: null,
});

const BACKOFFICE = [bo("bo_north", "NORTH"), bo("bo_south", "SOUTH"), bo("bo_all", null)];
const MEMBERS = [dealer("dealer_1"), dealer("dealer_2")];

function deps(over: Partial<ResolveDeps> = {}): ResolveDeps {
  return {
    backofficeUsers: async () => BACKOFFICE,
    companyMembers: async () => MEMBERS,
    mutedUids: async () => [],
    ...over,
  };
}

const uids = (d: { uid: string }[]) => d.map((x) => x.uid).sort();

const messageEvent = (over: Partial<Extract<NotificationEvent, { kind: "messageCreated" }>> = {}) =>
  ({
    kind: "messageCreated",
    dossierId: "dos_1",
    region: "NORTH",
    companyId: "comp_1",
    senderUid: "bo_north",
    senderRole: "backoffice",
    senderName: "Lou Verdier - Bike-eco",
    moto: "Yamaha MT-07",
    ...over,
  }) as NotificationEvent;

// ─── région fan-out ──────────────────────────────────────────────────────────

test("a new company reaches its région plus Toute-la-France, and no one else", async () => {
  const out = await resolveDeliveries(
    {
      kind: "companyRegistered",
      companyId: "comp_1",
      companyName: "Garage du Nord",
      createdByName: "Camille Durand",
      region: "NORTH",
    },
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "bo_north"]);
});

test("a new company targets its own company page", async () => {
  const out = await resolveDeliveries(
    {
      kind: "companyRegistered",
      companyId: "comp_1",
      companyName: "Garage du Nord",
      createdByName: "Camille Durand",
      region: "SOUTH",
    },
    deps(),
  );
  expect(out[0].target).toEqual({ kind: "company", companyId: "comp_1" });
  expect(uids(out)).toEqual(["bo_all", "bo_south"]);
});

test("a new dossier reaches the région's back office and targets the dossier", async () => {
  const out = await resolveDeliveries(
    {
      kind: "dossierCreated",
      dossierId: "dos_1",
      region: "SOUTH",
      companyName: "Garage du Sud",
      sellerName: "Camille Durand",
    },
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "bo_south"]);
  expect(out[0].target).toEqual({ kind: "dossier", dossierId: "dos_1" });
  expect(out[0].content.title).toBe(
    "Une nouvelle proposition d'achat vient d'être publié.",
  );
});

test("a new dossier never notifies the dealers who filed it", async () => {
  const out = await resolveDeliveries(
    {
      kind: "dossierCreated",
      dossierId: "dos_1",
      region: "NORTH",
      companyName: "Garage du Nord",
      sellerName: "Camille Durand",
    },
    deps(),
  );
  expect(uids(out)).not.toContain("dealer_1");
});

// ─── messages ────────────────────────────────────────────────────────────────

test("a back-office message reaches the company and the other back-office members", async () => {
  const out = await resolveDeliveries(messageEvent(), deps());
  expect(uids(out)).toEqual(["bo_all", "dealer_1", "dealer_2"]);
});

test("the sender is never notified of their own message", async () => {
  const out = await resolveDeliveries(messageEvent({ senderUid: "bo_all" }), deps());
  expect(uids(out)).not.toContain("bo_all");
});

test("a b2b message does NOT reach the sender's own teammates", async () => {
  // The b2b copy is hardcoded to "de Bike-eco", so notifying a teammate would
  // misattribute their colleague's message to the Bike-eco team.
  const out = await resolveDeliveries(
    messageEvent({ senderUid: "dealer_1", senderRole: "b2b", senderName: "Camille Durand - Garage du Nord" }),
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "bo_north"]);
});

test("copy differs by recipient role on the same message", async () => {
  const out = await resolveDeliveries(messageEvent(), deps());
  const toBackoffice = out.find((d) => d.uid === "bo_all")!;
  const toDealer = out.find((d) => d.uid === "dealer_1")!;
  expect(toBackoffice.content.title).toBe("1 nouveau message de Lou Verdier");
  expect(toDealer.content.title).toBe("1 nouveau message de Bike-eco");
  expect(toDealer.content.body).toBe("Pour la Yamaha MT-07");
});

test("a message targets the chat, not the dossier", async () => {
  const out = await resolveDeliveries(messageEvent(), deps());
  expect(out[0].target).toEqual({ kind: "chat", dossierId: "dos_1" });
});

// ─── mutes ───────────────────────────────────────────────────────────────────

test("a muted uid is dropped from a message fan-out", async () => {
  const out = await resolveDeliveries(
    messageEvent(),
    deps({ mutedUids: async () => ["dealer_1", "bo_all"] }),
  );
  expect(uids(out)).toEqual(["dealer_2"]);
});

test("mutes do not apply to the new-dossier event", async () => {
  // Nobody can have muted a dossier that has only just been created, but the
  // resolver must not go looking either — it has no subcollection to read.
  const out = await resolveDeliveries(
    {
      kind: "dossierCreated",
      dossierId: "dos_1",
      region: "NORTH",
      companyName: "Garage du Nord",
      sellerName: "Camille Durand",
    },
    deps({
      mutedUids: async () => {
        throw new Error("must not be called");
      },
    }),
  );
  expect(uids(out)).toEqual(["bo_all", "bo_north"]);
});

// ─── status / price ──────────────────────────────────────────────────────────

test("a status change reaches the company and the région, minus the actor", async () => {
  const out = await resolveDeliveries(
    {
      kind: "statusChanged",
      dossierId: "dos_1",
      region: "NORTH",
      companyId: "comp_1",
      actorUid: "bo_north",
      moto: "Yamaha MT-07",
      status: "cloture",
    },
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "dealer_1", "dealer_2"]);
  expect(out[0].content).toEqual({
    title: "Le statut de la Yamaha MT-07 a évolué",
    body: "Nouveau statut: Clôturé",
  });
  expect(out[0].target).toEqual({ kind: "dossier", dossierId: "dos_1" });
});

test("a status change reads the same for both roles", async () => {
  const out = await resolveDeliveries(
    {
      kind: "statusChanged",
      dossierId: "dos_1",
      region: "NORTH",
      companyId: "comp_1",
      actorUid: "bo_north",
      moto: "Yamaha MT-07",
      status: "en_cours",
    },
    deps(),
  );
  const titles = new Set(out.map((d) => d.content.title));
  expect(titles.size).toBe(1);
});

test("a price change reaches the same set and formats euros", async () => {
  const out = await resolveDeliveries(
    {
      kind: "priceChanged",
      dossierId: "dos_1",
      region: "SOUTH",
      companyId: "comp_1",
      actorUid: "bo_south",
      moto: "Yamaha MT-07",
      validatedPrice: 4200,
    },
    deps(),
  );
  expect(uids(out)).toEqual(["bo_all", "dealer_1", "dealer_2"]);
  expect(out[0].content.body).toBe("Prix validé: 4200 €");
});

test("no recipients yields no deliveries rather than throwing", async () => {
  const out = await resolveDeliveries(
    messageEvent({ senderUid: "bo_north" }),
    deps({ backofficeUsers: async () => [], companyMembers: async () => [] }),
  );
  expect(out).toEqual([]);
});
