import { sendMessageSchema } from "./schemas";

const valid = {
  dossierId: "dos_1",
  messageId: "msg_1",
  text: "Bonjour",
  attachments: [],
};

const attachment = {
  type: "pdf" as const,
  url: "https://x/o/dossiers%2Fc%2Fd%2Fmessages%2Fm%2Foffre.pdf?alt=media",
  name: "offre.pdf",
  size: 1024,
};

test("a valid text-only message parses", () => {
  expect(() => sendMessageSchema.parse(valid)).not.toThrow();
});

test("a valid message with one attachment parses", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, attachments: [attachment] }),
  ).not.toThrow();
});

test("text over 4096 chars is rejected", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "a".repeat(4097) }),
  ).toThrow();
});

test("text of exactly 4096 chars is allowed", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "a".repeat(4096) }),
  ).not.toThrow();
});

test("more than 5 attachments is rejected", () => {
  const six = Array.from({ length: 6 }, () => attachment);
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: six }),
  ).toThrow();
});

test("exactly 5 attachments is allowed", () => {
  const five = Array.from({ length: 5 }, () => attachment);
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: five }),
  ).not.toThrow();
});

test("a fully empty message (no text, no attachments) is rejected", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: [] }),
  ).toThrow();
});

test("whitespace-only text with no attachments is rejected", () => {
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "   ", attachments: [] }),
  ).toThrow();
});

test("attachment size over 10 MB is rejected", () => {
  const big = { ...attachment, size: 10 * 1024 * 1024 + 1 };
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: [big] }),
  ).toThrow();
});

test("attachment name over 255 chars is rejected", () => {
  const longName = { ...attachment, name: "a".repeat(256) };
  expect(() =>
    sendMessageSchema.parse({ ...valid, text: "", attachments: [longName] }),
  ).toThrow();
});
