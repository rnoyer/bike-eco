import { dossierRecapSchema } from "./schemas";

test("dossierId accepts letters, digits, underscore and hyphen", () => {
  expect(dossierRecapSchema.safeParse({ dossierId: "dos_1-AbC9" }).success).toBe(true);
});

test("dossierId rejects a multi-segment path", () => {
  expect(dossierRecapSchema.safeParse({ dossierId: "dos_1/messages/msg_1" }).success).toBe(false);
});

test("dossierId rejects an empty string", () => {
  expect(dossierRecapSchema.safeParse({ dossierId: "" }).success).toBe(false);
});
