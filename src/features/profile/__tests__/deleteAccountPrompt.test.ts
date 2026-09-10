import { describe, expect, test } from "@jest/globals";

import { deleteAccountPrompt } from "../deleteAccountPrompt";

const vendeur = { isAdmin: false };
const autreAdmin = { isAdmin: true };

const b2b = (over: Partial<Parameters<typeof deleteAccountPrompt>[0]> = {}) =>
  deleteAccountPrompt({
    role: "b2b",
    isAdmin: true,
    others: [autreAdmin, vendeur],
    companyId: "comp_1",
    companyName: "Moto Dupont",
    ...over,
  });

describe("b2b", () => {
  test("an admin with another admin left gets the plain confirmation", () => {
    const p = b2b();
    expect(p.action).toBe("delete");
    expect(p.message).toContain("Vos dossiers et vos conversations sont conservés");
  });

  test("a vendeur gets the plain confirmation", () => {
    expect(b2b({ isAdmin: false }).action).toBe("delete");
  });

  test("the sole admin of a company that still has vendeurs is sent to Paramètres", () => {
    const p = b2b({ others: [vendeur] });
    expect(p.action).toBe("manage");
    expect(p.actionLabel).toBe("Gérer mes collaborateurs");
    expect(p.message).toContain("dernier administrateur de l'entreprise Moto Dupont");
  });

  test("the last member is warned the company goes with them", () => {
    const p = b2b({ others: [] });
    expect(p.action).toBe("deleteWithCompany");
    expect(p.actionLabel).toBe("Supprimer mon compte");
    expect(p.message).toContain("toutes les données relatives à l'entreprise Moto Dupont");
  });

  // Last member wins: it subsumes "sole admin", and it is the branch the user
  // can act on. Sending them to Paramètres to promote a colleague who does not
  // exist would be a dead end.
  test("the last member is not sent to Paramètres to promote nobody", () => {
    expect(b2b({ others: [], isAdmin: true }).action).toBe("deleteWithCompany");
  });

  test("a lone vendeur also takes the company with them — no orphan is left", () => {
    expect(b2b({ isAdmin: false, others: [] }).action).toBe("deleteWithCompany");
  });

  // The server does a plain self-delete for a caller with no scope; an empty
  // `others` here is "no company", not "last member of one".
  test("an orphaned account with no company gets the plain confirmation", () => {
    const p = b2b({ companyId: null, companyName: null, others: [] });
    expect(p.action).toBe("delete");
  });

  test("the company name falls back while the company read is in flight", () => {
    const p = b2b({ others: [], companyName: null });
    expect(p.message).toContain("relatives à votre entreprise et aux dossiers");
    expect(p.message).not.toContain("l'entreprise .");
  });
});

describe("back-office", () => {
  const bo = (over: Partial<Parameters<typeof deleteAccountPrompt>[0]> = {}) =>
    deleteAccountPrompt({
      role: "backoffice",
      isAdmin: true,
      others: [autreAdmin, vendeur],
      companyId: null,
      companyName: null,
      ...over,
    });

  test("an admin with another admin left gets the plain confirmation", () => {
    expect(bo().action).toBe("delete");
  });

  test("a member gets the plain confirmation", () => {
    expect(bo({ isAdmin: false }).action).toBe("delete");
  });

  test("the sole admin of a team with members left is sent to Paramètres", () => {
    const p = bo({ others: [vendeur] });
    expect(p.action).toBe("manage");
    expect(p.actionLabel).toBe("Gérer les membres");
    expect(p.message).toContain("dernier administrateur de Bike-eco");
  });

  // Bike-eco is the app, not a tenant: nothing cascades, and an empty team
  // locks everyone out — inviting and promoting both need an admin caller.
  test("the last member is asked to invite someone, never offered a deletion", () => {
    const p = bo({ others: [] });
    expect(p.action).toBe("manage");
    expect(p.actionLabel).toBe("Inviter un membre");
    expect(p.message).toContain("dernier membre de Bike-eco");
  });

  test("the last member is never offered the company cascade", () => {
    expect(bo({ others: [] }).action).not.toBe("deleteWithCompany");
  });
});
