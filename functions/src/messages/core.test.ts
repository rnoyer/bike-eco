import {
  sendMessageCore,
  isAttachmentUnderMessagePrefix,
  type SendMessageDeps,
  type NewMessage,
} from "./core";
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

describe("isAttachmentUnderMessagePrefix", () => {
  const url = (path: string) =>
    `https://firebasestorage.googleapis.com/v0/b/bkt/o/${path}?alt=media&token=abc`;

  test("accepts a url under the exact company/dossier/message prefix", () => {
    const u = url("dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_1%2Foffre.pdf");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(true);
  });

  test("rejects a url under another company's prefix", () => {
    const u = url("dossiers%2Fcomp_2%2Fdos_1%2Fmessages%2Fmsg_1%2Foffre.pdf");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("rejects a url under another dossier's prefix", () => {
    const u = url("dossiers%2Fcomp_1%2Fdos_2%2Fmessages%2Fmsg_1%2Foffre.pdf");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("rejects a url under another message's prefix", () => {
    const u = url("dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_2%2Foffre.pdf");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("rejects a photos-folder url (right dossier, wrong subtree)", () => {
    const u = url("dossiers%2Fcomp_1%2Fdos_1%2Fphotos%2F0.jpg");
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("rejects query-string smuggling of the prefix on an external host", () => {
    const u =
      "https://evil.example/payload.pdf?y=dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_1%2F";
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("rejects an arbitrary external host mimicking the storage path", () => {
    const u =
      "https://evil.com/v0/b/bkt/o/dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_1%2Ffile.pdf";
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(false);
  });

  test("accepts the storage emulator (loopback) host", () => {
    const u =
      "http://127.0.0.1:9199/v0/b/bkt/o/dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_1%2Ffile.pdf";
    expect(isAttachmentUnderMessagePrefix(u, "comp_1", "dos_1", "msg_1")).toBe(true);
  });

  test("rejects an unparseable url", () => {
    expect(isAttachmentUnderMessagePrefix("not a url", "comp_1", "dos_1", "msg_1")).toBe(false);
  });
});

describe("sendMessageCore attachment-prefix enforcement", () => {
  const withAttachment = (path: string): SendMessageInput => ({
    dossierId: "dos_1",
    messageId: "msg_1",
    text: "",
    attachments: [
      {
        type: "pdf",
        url: `https://firebasestorage.googleapis.com/v0/b/bkt/o/${path}?alt=media`,
        name: "offre.pdf",
        size: 1024,
      },
    ],
  });

  test("an attachment under the correct prefix is written", async () => {
    const d = fakeDeps();
    await sendMessageCore(
      withAttachment("dossiers%2Fcomp_1%2Fdos_1%2Fmessages%2Fmsg_1%2Foffre.pdf"),
      dealer,
      d,
    );
    expect(d.written).toHaveLength(1);
    expect(d.written[0].attachments).toHaveLength(1);
  });

  test("an attachment pointing at another company is rejected, nothing written", async () => {
    const d = fakeDeps();
    await expect(
      sendMessageCore(
        withAttachment("dossiers%2Fcomp_2%2Fdos_1%2Fmessages%2Fmsg_1%2Foffre.pdf"),
        dealer,
        d,
      ),
    ).rejects.toMatchObject({ code: "invalid-argument" });
    expect(d.written).toHaveLength(0);
  });
});
