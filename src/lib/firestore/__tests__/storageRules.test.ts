import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { afterAll, beforeAll, test } from "@jest/globals";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { readFileSync } from "fs";
import { resolve } from "path";

let env: RulesTestEnvironment;

const b2bClaims = { role: "b2b", companyId: "comp_1", status: "active" };
const boClaims = { role: "backoffice", status: "active" };
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "bike-eco-43a84",
    storage: {
      rules: readFileSync(
        resolve(__dirname, "../../../../storage.rules"),
        "utf8",
      ),
    },
  });
});

afterAll(async () => env.cleanup());

test("unauthenticated uploads are denied", async () => {
  const storage = env.unauthenticatedContext().storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );
});

test("a dealer uploads into their own company's dossier path", async () => {
  const storage = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  await assertSucceeds(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );
});

test("a dealer cannot upload into another company's path", async () => {
  const storage = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_2/dos_9/photos/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );
});

test("backoffice attaches to any company's dossier", async () => {
  const storage = env.authenticatedContext("bo_1", boClaims).storage();
  await assertSucceeds(
    uploadBytes(
      ref(storage, "dossiers/comp_2/dos_9/messages/msg_1/offre.pdf"),
      jpeg,
      { contentType: "application/pdf" },
    ),
  );
});

test("only images and pdfs are accepted", async () => {
  const storage = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/x.html"), jpeg, {
      contentType: "text/html",
    }),
  );
});

// The rule leans on `matches()` being whole-string: the pattern's top-level
// alternation is only safe because RE2 anchors it. `text/html` and `image/svg+xml`
// would be rejected under partial-match semantics too, so neither proves it —
// a contentType that merely *starts* with an accepted type does.
test("a content type that only prefixes an accepted one is rejected", async () => {
  const storage = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/x.pdfx"), jpeg, {
      contentType: "application/pdfx",
    }),
  );
});

// `image/.*` would admit this; the app only ever produces jpeg/png/heic/heif/
// webp, and svg can carry an executable <script> if its download URL is ever
// opened directly, so it must stay outside the accepted content-type set.
// The left alternation branch must be end-anchored too: a type that merely
// prefixes an accepted image subtype must be rejected. Proves the grouping.
test("a content type prefixing an accepted image type is rejected", async () => {
  const storage = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/x.jpgx"), jpeg, {
      contentType: "image/jpegx",
    }),
  );
});

test("svg images are rejected even though they are `image/*`", async () => {
  const storage = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/x.svg"), jpeg, {
      contentType: "image/svg+xml",
    }),
  );
});

test("oversized files are rejected", async () => {
  const storage = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  const tooBig = new Uint8Array(11 * 1024 * 1024);
  await assertFails(
    uploadBytes(ref(storage, "dossiers/comp_1/dos_1/photos/big.jpg"), tooBig, {
      contentType: "image/jpeg",
    }),
  );
});

test("a dealer can delete their own upload (failed-submission cleanup)", async () => {
  const storage = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  const target = ref(storage, "dossiers/comp_1/dos_cleanup/photos/0.jpg");
  await assertSucceeds(uploadBytes(target, jpeg, { contentType: "image/jpeg" }));
  await assertSucceeds(deleteObject(target));
});

test("a dealer cannot delete another company's upload", async () => {
  const bo = env.authenticatedContext("bo_1", boClaims).storage();
  await assertSucceeds(
    uploadBytes(ref(bo, "dossiers/comp_2/dos_victim/photos/0.jpg"), jpeg, {
      contentType: "image/jpeg",
    }),
  );

  const attacker = env.authenticatedContext("user_b2b_nord", b2bClaims).storage();
  await assertFails(
    deleteObject(ref(attacker, "dossiers/comp_2/dos_victim/photos/0.jpg")),
  );
});
