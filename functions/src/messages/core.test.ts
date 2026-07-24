import { sendMessageCore, type SendMessageDeps, type NewMessage } from "./core";
import type { CallerClaims } from "../registration/core";
import type { SendMessageInput } from "./schemas";

const input: SendMessageInput = {
  dossierId: "dos_1",
  messageId: "msg_1",
  text: "  Bonjour  ",
  attachments: [],
};

const dealer: CallerClaims = { uid: "u1", role: "b2b", status: "active", companyId: "comp_1" };
const backoffice: CallerClaims = { uid: "bo1", role: "backoffice", status: "active", companyId: null };

function fakeDeps(over: Partial<SendMessageDeps> = {}): SendMessageDeps & { written: NewMessage[] } {
  const written: NewMessage[] = [];
  return {
    written,
    getDossier: async () => ({ companyId: "comp_1" }),
    getUser: async () => ({ prenom: "Camille", nom: "Durand" }),
    getCompanyName: async () => "Garage du Nord",
    createMessage: async (_d, _m, data) => { written.push(data); },
    ...over,
  };
}

test("a dealer's message is stamped '[name] - [company]' from the company doc", async () => {
  const d = fakeDeps();
  await sendMessageCore(input, dealer, d);
  expect(d.written).toHaveLength(1);
  expect(d.written[0]).toMatchObject({
    senderId: "u1",
    senderName: "Camille Durand - Garage du Nord",
    senderRole: "b2b",
    text: "Bonjour",
    attachments: [],
  });
});

test("a backoffice message is stamped '[name] - Bike-eco'", async () => {
  const d = fakeDeps({ getUser: async () => ({ prenom: "Alex", nom: "Martin" }) });
  await sendMessageCore(input, backoffice, d);
  expect(d.written[0].senderName).toBe("Alex Martin - Bike-eco");
  expect(d.written[0].senderRole).toBe("backoffice");
});

test("a dealer cannot message on another company's dossier", async () => {
  const d = fakeDeps({ getDossier: async () => ({ companyId: "comp_2" }) });
  await expect(sendMessageCore(input, dealer, d)).rejects.toMatchObject({ code: "permission-denied" });
  expect(d.written).toHaveLength(0);
});

test("a non-active caller is rejected", async () => {
  const d = fakeDeps();
  const pending: CallerClaims = { uid: "u1", role: "b2b", status: "pending", companyId: "comp_1" };
  await expect(sendMessageCore(input, pending, d)).rejects.toMatchObject({ code: "permission-denied" });
});

test("a missing dossier is not-found", async () => {
  const d = fakeDeps({ getDossier: async () => null });
  await expect(sendMessageCore(input, dealer, d)).rejects.toMatchObject({ code: "not-found" });
});

test("a duplicate messageId (createMessage rejects) propagates", async () => {
  const d = fakeDeps({ createMessage: async () => { throw new Error("ALREADY_EXISTS"); } });
  await expect(sendMessageCore(input, dealer, d)).rejects.toThrow("ALREADY_EXISTS");
});
