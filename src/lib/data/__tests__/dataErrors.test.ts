import { expect, test } from "@jest/globals";

import { isExpectedAccessLoss, mapDataError } from "../dataErrors";

test("permission-denied is an expected access loss", () => {
  // What a live listener receives when its dossier is deleted: the rules reach
  // through the dossier document, so an absent one denies rather than empties.
  expect(isExpectedAccessLoss("permission-denied")).toBe(true);
});

test("not-found is an expected access loss", () => {
  expect(isExpectedAccessLoss("not-found")).toBe(true);
});

test("a transient network failure is not an expected access loss", () => {
  // `unavailable` is a dropped connection the listener recovers from on its
  // own — still worth reporting, unlike a document that is simply gone.
  expect(isExpectedAccessLoss("unavailable")).toBe(false);
});

test("an unrecognised code is not an expected access loss", () => {
  // Fail loud: a code we have not reasoned about must not be silenced.
  expect(isExpectedAccessLoss("internal")).toBe(false);
  expect(isExpectedAccessLoss("")).toBe(false);
});

test("mapDataError still maps the known codes to French copy", () => {
  expect(mapDataError("permission-denied")).toBe(
    "Vous n'avez pas accès à ce dossier.",
  );
  expect(mapDataError("not-found")).toBe("Ce dossier n'existe plus.");
  expect(mapDataError("nope")).toBe(
    "Une erreur est survenue. Veuillez réessayer.",
  );
});
