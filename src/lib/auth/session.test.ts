import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import { buildSessionUser, isAccountDeleted, isNewlyActivated } from "./session";
import type { AppUser } from "@/lib/firestore/schema";

const profile: AppUser = {
  role: "b2b", companyId: "comp_1", isAdmin: false,
  nom: "Durand", prenom: "Camille", email: "c@x.fr",
  telephone: "0600000000",
  status: "active", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
};

test("merges uid + claims + profile, with claims authoritative for role/status", () => {
  const user = buildSessionUser("uid_1",
    { role: "b2b", companyId: "comp_1", status: "active" },
    { ...profile, role: "backoffice", status: "pending" }, // stale profile
  );
  expect(user.id).toBe("uid_1");
  expect(user.role).toBe("b2b");     // from claims, not the stale profile
  expect(user.status).toBe("active"); // from claims
  expect(user.nom).toBe("Durand");   // from profile
});

test("a server snapshot with no profile doc means the account was deleted", () => {
  expect(isAccountDeleted({ exists: false, fromCache: false })).toBe(true);
});

test("a profile that still exists is not a deletion", () => {
  expect(isAccountDeleted({ exists: true, fromCache: false })).toBe(false);
  expect(isAccountDeleted({ exists: true, fromCache: true })).toBe(false);
});

test("a cache-only miss is not a deletion — offline, absent means unknown", () => {
  expect(isAccountDeleted({ exists: false, fromCache: true })).toBe(false);
});

test("a profile that went active while the claims still say pending is an activation", () => {
  expect(
    isNewlyActivated({ profileStatus: "active", sessionStatus: "pending" }),
  ).toBe(true);
});

test("an already-active session is not re-activated", () => {
  expect(
    isNewlyActivated({ profileStatus: "active", sessionStatus: "active" }),
  ).toBe(false);
});

test("a profile that is not active is never an activation", () => {
  expect(
    isNewlyActivated({ profileStatus: "pending", sessionStatus: "pending" }),
  ).toBe(false);
  // The deleted-account watch owns the missing-profile case.
  expect(
    isNewlyActivated({ profileStatus: undefined, sessionStatus: "pending" }),
  ).toBe(false);
});
