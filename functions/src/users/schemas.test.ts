import { colleagueActionSchema, colleagueAdminSchema, updateMyProfileSchema } from "./schemas";

test("colleagueAdminSchema accepts a uid and a boolean", () => {
  expect(colleagueAdminSchema.parse({ uid: "u1", isAdmin: true }))
    .toEqual({ uid: "u1", isAdmin: true });
});

test("colleagueAdminSchema rejects a missing uid", () => {
  expect(colleagueAdminSchema.safeParse({ isAdmin: true }).success).toBe(false);
});

test("colleagueAdminSchema rejects a non-boolean isAdmin", () => {
  expect(colleagueAdminSchema.safeParse({ uid: "u1", isAdmin: "yes" }).success).toBe(false);
});

test("colleagueActionSchema rejects a blank uid", () => {
  expect(colleagueActionSchema.safeParse({ uid: "   " }).success).toBe(false);
});

test("updateMyProfileSchema accepts a single field", () => {
  expect(updateMyProfileSchema.parse({ prenom: "Romain" })).toEqual({ prenom: "Romain" });
});

test("updateMyProfileSchema accepts all three at once", () => {
  expect(
    updateMyProfileSchema.parse({ nom: "Noyer", prenom: "Romain", telephone: "0601020304" }),
  ).toEqual({ nom: "Noyer", prenom: "Romain", telephone: "0601020304" });
});

test("updateMyProfileSchema trims the names", () => {
  expect(updateMyProfileSchema.parse({ nom: "  Noyer  " })).toEqual({ nom: "Noyer" });
});

test("updateMyProfileSchema rejects an empty payload", () => {
  expect(updateMyProfileSchema.safeParse({}).success).toBe(false);
});

test("updateMyProfileSchema rejects a blank name", () => {
  expect(updateMyProfileSchema.safeParse({ nom: "   " }).success).toBe(false);
});

test("updateMyProfileSchema rejects a phone that is not 10 digits", () => {
  expect(updateMyProfileSchema.safeParse({ telephone: "06 01 02 03 04" }).success).toBe(false);
  expect(updateMyProfileSchema.safeParse({ telephone: "060102030" }).success).toBe(false);
});
