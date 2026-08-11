import { expect, test } from "@jest/globals";

import { deleteDossierSchema } from "./schemas";

test("accepts a plain document id", () => {
  expect(deleteDossierSchema.parse({ dossierId: "dos_1" })).toEqual({ dossierId: "dos_1" });
});

test("trims surrounding whitespace", () => {
  expect(deleteDossierSchema.parse({ dossierId: "  dos_1  " })).toEqual({ dossierId: "dos_1" });
});

test("rejects a multi-segment path", () => {
  // Without the single-segment guard this resolves to an unrelated document
  // under `db().collection("dossiers").doc(id)`.
  expect(() => deleteDossierSchema.parse({ dossierId: "dos_1/messages/msg_1" })).toThrow();
});

test("rejects an empty id", () => {
  expect(() => deleteDossierSchema.parse({ dossierId: "   " })).toThrow();
});
