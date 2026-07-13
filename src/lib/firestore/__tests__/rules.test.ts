import { afterAll, beforeAll, test } from "@jest/globals";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

const b2bClaims = { role: "b2b", companyId: "comp_1", status: "active" };
const boClaims = { role: "backoffice", region: "NORTH", status: "active" };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "bike-eco-43a84",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"),
    },
  });
  // Seed docs bypassing rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "dossiers/dos_1"), { companyId: "comp_1" });
    await setDoc(doc(db, "dossiers/dos_2"), { companyId: "comp_2" });
    await setDoc(doc(db, "users/user_b2b"), { nom: "Durand" });
  });
});

afterAll(async () => env.cleanup());

test("unauthenticated reads are denied", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "dossiers/dos_1")));
});

test("a b2b user reads only their company's dossiers", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "dossiers/dos_1")));
  await assertFails(getDoc(doc(db, "dossiers/dos_2")));
});

test("backoffice reads any dossier", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "dossiers/dos_2")));
});

test("owner cannot escalate their own claims fields", async () => {
  const db = env.authenticatedContext("user_b2b", b2bClaims).firestore();
  await assertSucceeds(updateDoc(doc(db, "users/user_b2b"), { ville: "Lyon" }));
  await assertFails(updateDoc(doc(db, "users/user_b2b"), { role: "backoffice" }));
});
