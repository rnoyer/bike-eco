import { describe, expect, test } from "@jest/globals";
import { b2bInvitedRegistrationSchema } from "@/features/b2b-invited-registration/schema";

const valid = {
  email: "teammate@garage.fr",
  password: "secret12",
  confirmPassword: "secret12",
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
    expect(b2bInvitedRegistrationSchema.safeParse({ ...valid, password: "x", confirmPassword: "x" }).success).toBe(false);
  });

  test("rejects a confirmation that does not match the password", () => {
    expect(b2bInvitedRegistrationSchema.safeParse({ ...valid, confirmPassword: "secret13" }).success).toBe(false);
  });

  test("reports the mismatch on confirmPassword, not password", () => {
    const result = b2bInvitedRegistrationSchema.safeParse({ ...valid, confirmPassword: "secret13" });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("confirmPassword");
    expect(paths).not.toContain("password");
  });

  test("catches the mismatch while later-step fields are still empty", () => {
    // The account step is step 1 here, so nom/prenom/telephone are always
    // blank when it is validated — the cross-field check must still fire.
    const result = b2bInvitedRegistrationSchema.safeParse({
      ...valid,
      confirmPassword: "secret13",
      nom: "",
      prenom: "",
      telephone: "",
    });
    expect(result.success).toBe(false);
    expect(result.error!.issues.map((i) => i.path.join("."))).toContain("confirmPassword");
  });

  test("rejects a phone that is not 10 digits", () => {
    expect(b2bInvitedRegistrationSchema.safeParse({ ...valid, telephone: "061234" }).success).toBe(false);
  });

  test("regionGeree is optional and defaults to null (Toute la France)", () => {
    // A b2b invitee never sees the field, and a back-office invitee may skip
    // it — neither may be blocked on "Suivant" for it.
    expect("regionGeree" in valid).toBe(false);
    const result = b2bInvitedRegistrationSchema.safeParse(valid);
    expect(result.success).toBe(true);
    expect(result.data!.regionGeree).toBeNull();
  });

  test("regionGeree keeps the picked dropdown label", () => {
    const result = b2bInvitedRegistrationSchema.safeParse({ ...valid, regionGeree: "Moitié sud" });
    expect(result.success).toBe(true);
    expect(result.data!.regionGeree).toBe("Moitié sud");
  });
});
