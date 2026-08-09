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
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
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
  updatedBy: "user_b2b_nord",
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
      // Seeded so a test asserting on some *other* clause is not silently
      // denied by the missing-`updatedBy` one — the update rule requires it on
      // every write.
      updatedBy: "user_b2b_nord",
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

// ── notificationRegion ─────────────────────────────────────────────────────

test("a user sets their own notificationRegion to a real region", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "users/user_bo"), { notificationRegion: "NORTH" }),
  );
});

test("a user sets their own notificationRegion to null (Toute la France)", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "users/user_bo"), { notificationRegion: null }),
  );
});

test("a user cannot set notificationRegion to a junk string", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertFails(
    updateDoc(doc(db, "users/user_bo"), { notificationRegion: "MARS" }),
  );
});

test("a user cannot set notificationRegion to a non-string value", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertFails(
    updateDoc(doc(db, "users/user_bo"), { notificationRegion: 42 }),
  );
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
      // The tightened update rule requires the caller to stamp updatedBy on
      // every update (see the two updatedBy-specific tests below).
      updatedBy: "bo_1",
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
  // Every payload carries a valid `updatedBy`, so the *only* clause left that
  // can deny it is the value domain under test. Without it these assertions
  // are vacuous: they pass on the `updatedBy == request.auth.uid` clause
  // instead, and deleting the domain checks from firestore.rules would not
  // turn a single one of them red. (They passed for the right reason only by
  // accident of test order — the update test above happens to stamp
  // `updatedBy` onto the shared `dos_1` seed first, and nothing clears
  // Firestore between tests.)
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), {
      status: "banana",
      updatedBy: "bo_1",
    }),
  );
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), { region: "MARS", updatedBy: "bo_1" }),
  );
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), {
      validatedPrice: -50,
      updatedBy: "bo_1",
    }),
  );
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), {
      validatedPrice: "cher",
      updatedBy: "bo_1",
    }),
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

// ── updatedBy ─────────────────────────────────────────────────────────────

test("a dossier cannot be created with someone else's updatedBy", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    addDoc(collection(db, "dossiers"), newDossier({ updatedBy: "user_bo" })),
  );
});

test("the back office stamps updatedBy with its own uid on update", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "dossiers/dos_1"), {
      status: "en_cours",
      region: "NORTH",
      validatedPrice: 4200,
      updatedBy: "user_bo",
      updatedAt: new Date(),
    }),
  );
});

test("the back office cannot attribute an update to someone else", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertFails(
    updateDoc(doc(db, "dossiers/dos_1"), {
      status: "en_cours",
      region: "NORTH",
      validatedPrice: 4200,
      updatedBy: "user_b2b_nord",
      updatedAt: new Date(),
    }),
  );
});

// ── mutes ──────────────────────────────────────────────────────────────────

test("a user writes and deletes their own mute on a dossier they can read", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  const ref = doc(db, "dossiers/dos_1/mutes/user_b2b_nord");
  await assertSucceeds(setDoc(ref, { createdAt: new Date() }));
  await assertSucceeds(getDoc(ref));
  await assertSucceeds(deleteDoc(ref));
});

test("a user cannot mute a dossier on someone else's behalf", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    setDoc(doc(db, "dossiers/dos_1/mutes/user_mate"), { createdAt: new Date() }),
  );
});

test("a dealer cannot mute another company's dossier", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertFails(
    setDoc(doc(db, "dossiers/dos_2/mutes/user_b2b_nord"), {
      createdAt: new Date(),
    }),
  );
});

test("a back-office user can mute any dossier, including another company's", async () => {
  const db = env.authenticatedContext("bo_1", boClaims).firestore();
  await assertSucceeds(
    setDoc(doc(db, "dossiers/dos_2/mutes/bo_1"), { createdAt: new Date() }),
  );
});

// ── push tokens ────────────────────────────────────────────────────────────

test("a user writes and reads their own push token", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  const ref = doc(db, "users/user_b2b_nord/pushTokens/device_1");
  await assertSucceeds(
    setDoc(ref, { token: "tok", platform: "android", updatedAt: new Date() }),
  );
  await assertSucceeds(getDoc(ref));
});

test("a push token row must carry a plausible token and a known platform", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  const ref = doc(db, "users/user_b2b_nord/pushTokens/device_3");
  // Owning the row is not enough: the values are pinned so the subcollection
  // `tokensFor` reads on every fan-out cannot be packed with junk.
  await assertFails(
    setDoc(ref, { token: 42, platform: "android", updatedAt: new Date() }),
  );
  await assertFails(
    setDoc(ref, { token: "", platform: "android", updatedAt: new Date() }),
  );
  await assertFails(
    setDoc(ref, { token: "tok", platform: "windows", updatedAt: new Date() }),
  );
  await assertFails(
    setDoc(ref, {
      token: "tok",
      platform: "ios",
      updatedAt: new Date(),
      payload: "x".repeat(500),
    }),
  );
  // An allowed key with an unchecked type is the same hole as an extra key:
  // the blob just moves into `updatedAt`.
  await assertFails(
    setDoc(ref, {
      token: "tok",
      platform: "ios",
      updatedAt: "x".repeat(5000),
    }),
  );
});

test("the exact row registerPushToken writes is accepted", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  // Mirrors `registerPushToken` byte for byte. The other happy-path test uses
  // `new Date()`, which would still pass `is timestamp` even if the sentinel
  // did not — so without this the rule could reject every real registration
  // while the suite stayed green.
  await assertSucceeds(
    setDoc(doc(db, "users/user_b2b_nord/pushTokens/device_4"), {
      token: "fcm-token-value",
      platform: "android",
      updatedAt: serverTimestamp(),
    }),
  );
});

test("a user may delete their own push token row", async () => {
  const db = env.authenticatedContext("user_b2b_nord", b2bClaims).firestore();
  await assertSucceeds(
    deleteDoc(doc(db, "users/user_b2b_nord/pushTokens/device_1")),
  );
});

test("push tokens are private — even the back office cannot read them", async () => {
  const db = env.authenticatedContext("user_bo", boClaims).firestore();
  await assertFails(getDoc(doc(db, "users/user_b2b_nord/pushTokens/device_1")));
  await assertFails(
    setDoc(doc(db, "users/user_b2b_nord/pushTokens/device_2"), {
      token: "tok",
      platform: "ios",
      updatedAt: new Date(),
    }),
  );
});
