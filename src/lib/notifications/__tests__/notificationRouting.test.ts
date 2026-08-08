import { expect, test } from "@jest/globals";
import { resolveRoute } from "@/lib/notifications/notificationRouting";

test("a dossier target routes into the viewer's own group", () => {
  expect(resolveRoute({ kind: "dossier", dossierId: "dos_1" }, "b2b")).toBe(
    "/(b2b)/dossier/dos_1",
  );
  expect(resolveRoute({ kind: "dossier", dossierId: "dos_1" }, "backoffice")).toBe(
    "/(backoffice)/dossier/dos_1",
  );
});

test("a chat target routes to the dossier's chat tab", () => {
  expect(resolveRoute({ kind: "chat", dossierId: "dos_1" }, "b2b")).toBe(
    "/(b2b)/dossier/dos_1/chat",
  );
  expect(resolveRoute({ kind: "chat", dossierId: "dos_1" }, "backoffice")).toBe(
    "/(backoffice)/dossier/dos_1/chat",
  );
});

test("a company target is back-office only", () => {
  expect(resolveRoute({ kind: "company", companyId: "comp_1" }, "backoffice")).toBe(
    "/(backoffice)/companies/comp_1",
  );
  // A b2b user has no companies route; routing there would 404 the app.
  expect(resolveRoute({ kind: "company", companyId: "comp_1" }, "b2b")).toBeNull();
});

test("an unknown or malformed payload is ignored rather than throwing", () => {
  expect(resolveRoute(undefined, "b2b")).toBeNull();
  expect(resolveRoute({}, "b2b")).toBeNull();
  expect(resolveRoute({ kind: "banana", dossierId: "dos_1" }, "b2b")).toBeNull();
  expect(resolveRoute({ kind: "dossier" }, "b2b")).toBeNull();
  expect(resolveRoute({ kind: "dossier", dossierId: 42 }, "b2b")).toBeNull();
  expect(resolveRoute({ kind: "company" }, "backoffice")).toBeNull();
});

test("an empty id is treated as missing", () => {
  expect(resolveRoute({ kind: "dossier", dossierId: "" }, "b2b")).toBeNull();
});
