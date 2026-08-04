import { colleagueActionSchema, colleagueAdminSchema } from "./schemas";

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
