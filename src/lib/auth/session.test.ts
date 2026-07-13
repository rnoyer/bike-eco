import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import { buildSessionUser } from "./session";
import type { AppUser } from "@/lib/firestore/schema";

const profile: AppUser = {
  role: "b2b", companyId: "comp_1", region: null,
  nom: "Durand", prenom: "Camille", email: "c@x.fr",
  telephone: "0600000000", departement: "75 - Paris", ville: "Paris",
  status: "active", createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
};

test("merges uid + claims + profile, with claims authoritative for role/status", () => {
  const user = buildSessionUser("uid_1",
    { role: "b2b", companyId: "comp_1", region: null, status: "active" },
    { ...profile, role: "backoffice", status: "pending" }, // stale profile
  );
  expect(user.id).toBe("uid_1");
  expect(user.role).toBe("b2b");     // from claims, not the stale profile
  expect(user.status).toBe("active"); // from claims
  expect(user.nom).toBe("Durand");   // from profile
});
