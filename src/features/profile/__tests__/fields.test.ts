import { describe, expect, test } from "@jest/globals";

import {
  isEditableProfileField,
  profileFieldSchema,
} from "@/features/profile/fields";

describe("isEditableProfileField", () => {
  test("accepts the three editable fields", () => {
    expect(isEditableProfileField("nom")).toBe(true);
    expect(isEditableProfileField("prenom")).toBe(true);
    expect(isEditableProfileField("telephone")).toBe(true);
  });

  // Email is the Auth credential; it must never reach the edit form, even by
  // hand-typing the route.
  test("rejects email, an unknown field and a missing param", () => {
    expect(isEditableProfileField("email")).toBe(false);
    expect(isEditableProfileField("isAdmin")).toBe(false);
    expect(isEditableProfileField(undefined)).toBe(false);
  });
});

describe("profileFieldSchema", () => {
  test("a name is trimmed and must not be blank", () => {
    expect(profileFieldSchema("nom").parse({ value: "  Noyer  " }))
      .toEqual({ value: "Noyer" });
    const blank = profileFieldSchema("prenom").safeParse({ value: "   " });
    expect(blank.success).toBe(false);
    expect(blank.error?.issues[0].message).toBe("Saisissez votre prénom");
  });

  test("a phone must be exactly 10 digits", () => {
    expect(profileFieldSchema("telephone").parse({ value: "0601020304" }))
      .toEqual({ value: "0601020304" });
    const short = profileFieldSchema("telephone").safeParse({ value: "060102030" });
    expect(short.success).toBe(false);
    expect(short.error?.issues[0].message).toBe("Saisissez un numéro à 10 chiffres");
  });
});
