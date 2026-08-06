import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, test } from "@jest/globals";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { readFileSync } from "fs";
import { resolve } from "path";

let env: RulesTestEnvironment;

const b2bClaims = { role: "b2b", companyId: "comp_1", status: "active" };
const boClaims = { role: "backoffice", status: "active" };
const pendingClaims = { role: "b2b", companyId: "comp_1", status: "pending" };

/** Minimal dossier the create rule accepts; override to probe each clause. */
const newDossier = (overrides: Record<string, unknown> = {}) => ({
  status: "a_traiter",
  region: "NORTH",
  companyId: "comp_1",
  submittedBy: "user_b2b_nord",
  validatedPrice: null,
  photos: [],
  thumbnailUrl: null,
  ...overrides,
});

const newMessage = (overrides: Record<string, unknown> = {}) => ({
  senderId: "user_b2b_nord",
  senderName: "Camille Durand - Garage du Nord",
  senderRole: "b2b",
  text: "Bonjour",
  attachments: [],
  ...overrides,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "bike-eco-43a84",
    firestore: {
      rules: readFileSync(
        resolve(__dirname, "../../../../firestore.rules"),
        "utf8",
      ),
    },
  });
  // Seed docs bypassing rules.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "dossiers/dos_1"), {
      companyId: "comp_1",
      status: "a_traiter",
      region: "NORTH",
      validatedPrice: null,
    });
    await setDoc(doc(db, "dossiers/dos_2"), {
      companyId: "comp_2",
      status: "a_traiter",
      region: "SOUTH",
      validatedPrice: null,
    });
    await setDoc(doc(db, "users/user_b2b_nord"), { nom: "Durand" });
    await setDoc(doc(db, "users/user_mate"), {
      nom: "Petit", prenom: "Sam", role: "b2b", companyId: "comp_1", isAdmin: false,
    });
    await setDoc(doc(db, "users/user_other"), {
      nom: "Roux", prenom: "Alix", role: "b2b", companyId: "comp_2", isAdmin: false,
    });
    await setDoc(doc(db, "users/user_bo"), {
      nom: "Verdier", prenom: "Lou", role: "backoffice", companyId: null, isAdmin: true,
    });
  });
});

afterAll(async () => env.cleanup());

// ── reads ──────────────────────────────────────────────────────────────────

test("unauthenticated reads are denied", async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(db, "dossiers/dos_1")));
});

test("a b2b user reads only their company's dossiers", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "dossiers/dos_1")));
  await assertFails(getDoc(doc(db, "dossiers/dos_2")));
});

test("backoffice reads any dossier", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "dossiers/dos_2")));
});

test("owner cannot escalate their own claims fields", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertSucceeds(updateDoc(doc(db, "users/user_b2b_nord"), { telephone: "0699999999" }));
  await assertFails(updateDoc(doc(db, "users/user_b2b_nord"), { role: "backoffice" }));
});

test("a b2b user reads a colleague of the same company", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertSucceeds(getDoc(doc(db, "users/user_mate")));
});

test("a b2b user cannot read a user of another company", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(getDoc(doc(db, "users/user_other")));
});

test("a null-companyId account cannot read a back-office user via the teammate clause", async () => {
  // Back-office `users/{uid}` docs carry `companyId: null`. Without the
  // `myCompany() != null` guard, an active account whose own `companyId`
  // claim is also null (unassigned, or malformed) would match
  // `resource.data.companyId == myCompany()` as `null == null` and read
  // every back-office profile.
  const db = env
    .authenticatedContext("user_null_company", {
      role: "b2b",
      companyId: null,
      status: "active",
    })
    .firestore();
  await assertFails(getDoc(doc(db, "users/user_bo")));
});

test("a user cannot make themselves an admin", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(updateDoc(doc(db, "users/user_b2b_nord"), { isAdmin: true }));
});

// ── dossier create ─────────────────────────────────────────────────────────

test("a dealer files a dossier for their own company", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertSucceeds(addDoc(collection(db, "dossiers"), newDossier()));
});

test("a dealer cannot file against another company", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ companyId: "comp_2" })),
  );
});

test("a dealer cannot file as someone else", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ submittedBy: "user_bo" })),
  );
});

test("a dossier cannot be born already in progress or priced", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ status: "en_cours" })),
  );
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ validatedPrice: 4200 })),
  );
});

test("region must be a real region", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ region: "EAST" })),
  );
});

test("a pending account cannot file anything", async () => {
  const db = env.authenticatedContext("user_pending", pendingClaims).firestore();
  // `submittedBy` must be this caller's own uid: with the fixture default
  // ("user_b2b_nord") the create is denied for impersonation, and the status gate —
  // the thing under test — never gets a say.
  await assertFails(
    addDoc(
      collection(db, "dossiers"),
      newDossier({ submittedBy: "user_pending" }),
    ),
  );
});

test("backoffice does not file dossiers", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ companyId: "comp_1" })),
  );
});

// ── dossier update ─────────────────────────────────────────────────────────

test("backoffice updates status, region and validated price", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "dossiers/dos_1"), {
      status: "en_cours",
      region: "SOUTH",
      validatedPrice: 4200,
    }),
  );
});

test("backoffice cannot move a dossier between companies", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), { companyId: "comp_2" }),
  );
});

test("backoffice cannot write an out-of-domain status, region or price", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertFails(updateDoc(doc(db, "dossiers/dos_1"), { status: "banana" }));
  await assertFails(updateDoc(doc(db, "dossiers/dos_1"), { region: "MARS" }));
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), { validatedPrice: -50 }),
  );
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), { validatedPrice: "cher" }),
  );
});

test("a dealer cannot update their own dossier", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), { validatedPrice: 99999 }),
  );
});

// ── messages ───────────────────────────────────────────────────────────────

test("no client can create a message directly (server-only via sendMessage)", async () => {
  const dealer = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(dealer, "dossiers/dos_1/messages"), newMessage()),
  );
  const bo = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertFails(
    addDoc(
      collection(bo, "dossiers/dos_1/messages"),
      newMessage({ senderId: "bo_1", senderRole: "backoffice" }),
    ),
  );
});

test("a dossier participant can still read messages", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(
      doc(ctx.firestore(), "dossiers/dos_1/messages/seed_msg"),
      newMessage(),
    );
  });
  const dealer = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertSucceeds(getDoc(doc(dealer, "dossiers/dos_1/messages/seed_msg")));
  const bo = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(getDoc(doc(bo, "dossiers/dos_1/messages/seed_msg")));
  const outsider = env
    .authenticatedContext("user_b2b_sud", { role: "b2b", companyId: "comp_2", status: "active" })
    .firestore();
  await assertFails(getDoc(doc(outsider, "dossiers/dos_1/messages/seed_msg")));
});

// ── invitations & companies (server-only) ──────────────────────────────────

test("clients cannot read or write invitations", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(getDoc(doc(db, "invitations/inv_1")));
  await assertFails(setDoc(doc(db, "invitations/inv_2"), { email: "x@x.fr" }));
});

test("clients cannot create a company", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    setDoc(doc(db, "companies/comp_x"), {
      siret: "12345678901234",
      name: "X",
      status: "pending",
    }),
  );
});

test("messages are immutable once sent", async () => {
  let id = "";
  await env.withSecurityRulesDisabled(async (ctx) => {
    const ref = await addDoc(
      collection(ctx.firestore(), "dossiers/dos_1/messages"),
      newMessage(),
    );
    id = ref.id;
  });
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    updateDoc(doc(db, `dossiers/dos_1/messages/${id}`), { text: "edited" }),
  );
});
