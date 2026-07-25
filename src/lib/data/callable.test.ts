import { expect, test } from "@jest/globals";
import { frenchError } from "./callable";

test("a server-authored message is preferred over the code map", () => {
  const err = { code: "functions/already-exists", message: "SIRET déjà pris." };
  expect(frenchError(err).message).toBe("SIRET déjà pris.");
});

test("without a server message, the code map provides generic French", () => {
  expect(frenchError({ code: "functions/already-exists" }).message).toBe(
    "Cette ressource existe déjà.",
  );
  expect(frenchError({ code: "functions/not-found" }).message).toBe(
    "Ressource introuvable.",
  );
  expect(frenchError({ code: "functions/failed-precondition" }).message).toBe(
    "Opération impossible dans l'état actuel.",
  );
});

test("unknown codes fall back to a generic French message", () => {
  expect(frenchError({ code: "functions/unknown" }).message).toBe(
    "Une erreur est survenue. Veuillez réessayer.",
  );
  expect(frenchError(undefined).message).toBe(
    "Une erreur est survenue. Veuillez réessayer.",
  );
});
