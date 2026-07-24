import { describe, expect, test } from "@jest/globals";
import { b2bInvitedRegistrationSchema } from "@/features/b2b-invited-registration/schema";

const valid = {
  email: "teammate@garage.fr",
  password: "secret12",
  nom: "Doe",
  prenom: "Jane",
  telephone: "0612345678",
};

describe("b2bInvitedRegistrationSchema", () => {
  test("accepts a valid invited registration", () => {
    expect(b2bInvitedRegistrationSchema.safeParse(valid).success).toBe(true);
  });

  test("rejects an invalid email", () => {
    expect(b2bInvitedRegistrationSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });

  test("rejects a password shorter than 8 characters", () => {
    expect(b2bInvitedRegistrationSchema.safeParse({ ...valid, password: "x" }).success).toBe(false);
  });

  test("rejects a phone that is not 10 digits", () => {
    expect(b2bInvitedRegistrationSchema.safeParse({ ...valid, telephone: "061234" }).success).toBe(false);
  });
});
