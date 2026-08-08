import { expect, test } from "@jest/globals";
import type { NotificationTrigger } from "expo-notifications";
import {
  isRemoteNotification,
  resolveRoute,
} from "@/lib/notifications/notificationRouting";

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

// ─── remote vs. locally scheduled ────────────────────────────────────────────
// Both call sites of `isRemoteNotification` are otherwise untestable listener
// wrappers, so the predicate they share carries the coverage: the iOS double
// banner (F2) and the double-routed tap both hinge on getting this right.

test("an FCM-delivered notification is remote", () => {
  expect(isRemoteNotification({ type: "push", payload: {} })).toBe(true);
});

test("a locally scheduled notification is not remote", () => {
  // `scheduleNotificationAsync({ trigger: null })` — what
  // `useForegroundNotifications` posts — plus the other shapes the union can
  // legally take on receipt. None of them may be mistaken for a push.
  expect(isRemoteNotification(null)).toBe(false);
  expect(isRemoteNotification(undefined)).toBe(false);
  expect(isRemoteNotification({ channelId: "default" })).toBe(false);
  expect(isRemoteNotification({ type: "unknown" })).toBe(false);
  // A schedulable trigger's `type` is an enum whose value is the same string;
  // cast rather than import the runtime enum from a native module into a test.
  expect(
    isRemoteNotification({
      type: "timeInterval",
      repeats: false,
      seconds: 1,
    } as unknown as NotificationTrigger),
  ).toBe(false);
});
