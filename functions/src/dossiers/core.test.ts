import { expect, test } from "@jest/globals";

import type { CallerClaims } from "../errors";
import { deleteDossierCore, type DossierDeleteDeps } from "./core";

const boCaller: CallerClaims = { uid: "bo1", role: "backoffice", status: "active", companyId: null };

function fakeDeps(over: Partial<DossierDeleteDeps> = {}) {
  const order: string[] = [];
  const deps: DossierDeleteDeps = {
    getDossier: async () => ({ companyId: "comp_1" }),
    deleteStorage: async (companyId, dossierId) => {
      order.push(`storage:${companyId}/${dossierId}`);
    },
    deleteDossier: async (id) => { order.push(`doc:${id}`); },
    ...over,
  };
  return { deps, order };
}

test("deletes Storage then the document, keyed by the stored companyId", async () => {
  // The companyId comes from the document, never the payload — that is what
  // stops a caller aiming the prefixed delete at another company's files.
  const { deps, order } = fakeDeps();
  await deleteDossierCore({ dossierId: "dos_1" }, boCaller, deps);
  expect(order).toEqual(["storage:comp_1/dos_1", "doc:dos_1"]);
});

test("rejects a b2b caller and deletes nothing", async () => {
  const { deps, order } = fakeDeps();
  await expect(
    deleteDossierCore({ dossierId: "dos_1" }, { uid: "u", role: "b2b", status: "active", companyId: "c" }, deps),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(order).toEqual([]);
});

test("rejects a back-office caller that is not active", async () => {
  const { deps, order } = fakeDeps();
  await expect(
    deleteDossierCore({ dossierId: "dos_1" }, { uid: "bo1", role: "backoffice", status: "pending", companyId: null }, deps),
  ).rejects.toMatchObject({ code: "permission-denied" });
  expect(order).toEqual([]);
});

test("rejects an unknown dossier before deleting anything", async () => {
  const { deps, order } = fakeDeps({ getDossier: async () => null });
  await expect(deleteDossierCore({ dossierId: "nope" }, boCaller, deps)).rejects.toMatchObject({
    code: "not-found",
  });
  expect(order).toEqual([]);
});

test("a failing Storage delete leaves the document alone", async () => {
  // Storage-first ordering means a half-failure leaves a readable dossier with
  // broken images — visible and retryable — rather than orphaned files no
  // document points at.
  const { deps, order } = fakeDeps({
    deleteStorage: async () => { throw new Error("bucket down"); },
  });
  await expect(deleteDossierCore({ dossierId: "dos_1" }, boCaller, deps)).rejects.toThrow("bucket down");
  expect(order).toEqual([]);
});
