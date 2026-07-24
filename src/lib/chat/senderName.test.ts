import { expect, test } from "@jest/globals";
import { Timestamp } from "firebase/firestore";
import type { SessionUser } from "@/lib/auth/session";
import { formatSenderName } from "./senderName";

const base: SessionUser = {
  id: "u1",
  role: "b2b",
  companyId: "comp_nord",
  nom: "Durand",
  prenom: "Camille",
  email: "c@x.fr",
  telephone: "0600000000",
  status: "active",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

test("a dealer is labelled with their company", () => {
  expect(formatSenderName(base, "Garage du Nord")).toBe(
    "Camille Durand - Garage du Nord",
  );
});

test("the team is always labelled Bike-eco, never a company", () => {
  const bo: SessionUser = {
    ...base,
    role: "backoffice",
    companyId: null,
    nom: "Martin",
    prenom: "Alex",
  };
  expect(formatSenderName(bo, "Garage du Nord")).toBe("Alex Martin - Bike-eco");
});
