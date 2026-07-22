import { expect, test } from "@jest/globals";
import { mapDataError } from "./dataErrors";

test("firestore denial and absence have their own copy", () => {
  expect(mapDataError("permission-denied")).toBe(
    "Vous n'avez pas accès à ce dossier.",
  );
  expect(mapDataError("not-found")).toBe("Ce dossier n'existe plus.");
});

test("network problems tell the user to check their connection", () => {
  expect(mapDataError("unavailable")).toBe(
    "Connexion impossible. Vérifiez votre réseau.",
  );
  expect(mapDataError("storage/retry-limit-exceeded")).toBe(
    "Connexion impossible. Vérifiez votre réseau.",
  );
});

test("storage denial is about the file, not the dossier", () => {
  expect(mapDataError("storage/unauthorized")).toBe(
    "Vous n'avez pas accès à ce fichier.",
  );
});

test("unknown codes fall back to a generic French message", () => {
  expect(mapDataError("internal")).toBe(
    "Une erreur est survenue. Veuillez réessayer.",
  );
  expect(mapDataError("")).toBe("Une erreur est survenue. Veuillez réessayer.");
});
