import { expect, test } from "@jest/globals";
import { colleagueScope, roleLabel, sortByName } from "../colleagues";

test("an admin is labelled Administrateur whatever the role", () => {
  expect(roleLabel({ role: "b2b", isAdmin: true })).toBe("Administrateur");
  expect(roleLabel({ role: "backoffice", isAdmin: true })).toBe("Administrateur");
});

test("a non-admin is Vendeur for b2b and Membre for back-office", () => {
  expect(roleLabel({ role: "b2b", isAdmin: false })).toBe("Vendeur");
  expect(roleLabel({ role: "backoffice", isAdmin: false })).toBe("Membre");
});

test("sortByName orders by nom then prénom, accent-insensitively", () => {
  const sorted = sortByName([
    { nom: "Durand", prenom: "Zoé" },
    { nom: "durand", prenom: "Alex" },
    { nom: "Bernard", prenom: "Sam" },
  ]);
  expect(sorted.map((u) => `${u.nom} ${u.prenom}`)).toEqual([
    "Bernard Sam", "durand Alex", "Durand Zoé",
  ]);
});

test("sortByName does not mutate its input", () => {
  const input = [{ nom: "B", prenom: "x" }, { nom: "A", prenom: "y" }];
  sortByName(input);
  expect(input[0].nom).toBe("B");
});

test("colleagueScope is the company for a b2b user", () => {
  expect(colleagueScope({ role: "b2b", companyId: "comp_1" }))
    .toEqual({ kind: "company", companyId: "comp_1" });
});

test("colleagueScope is the back-office team for a back-office user", () => {
  expect(colleagueScope({ role: "backoffice", companyId: null }))
    .toEqual({ kind: "backoffice" });
});

test("colleagueScope is null without a session or a company", () => {
  expect(colleagueScope(null)).toBeNull();
  expect(colleagueScope({ role: "b2b", companyId: null })).toBeNull();
});
