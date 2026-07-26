import { expect, test } from "@jest/globals";
import { mapAuthError, mapPasswordResetError } from "./authErrors";

test("bad credentials map to a specific message", () => {
  expect(mapAuthError("auth/invalid-credential")).toBe(
    "Email ou mot de passe incorrect.",
  );
  expect(mapAuthError("auth/wrong-password")).toBe(
    "Email ou mot de passe incorrect.",
  );
});

test("rate limiting and network have their own copy", () => {
  expect(mapAuthError("auth/too-many-requests")).toBe(
    "Trop de tentatives. Réessayez plus tard.",
  );
  expect(mapAuthError("auth/network-request-failed")).toBe(
    "Connexion impossible. Vérifiez votre réseau.",
  );
});

test("unknown codes fall back to a generic French message", () => {
  expect(mapAuthError("auth/internal-error")).toBe(
    "La connexion a échoué. Veuillez réessayer.",
  );
});

test("password reset does not reuse the wrong-password copy", () => {
  expect(mapPasswordResetError("auth/user-not-found")).toBe(
    "Aucun compte n’est associé à cet email.",
  );
  expect(mapPasswordResetError("auth/too-many-requests")).toBe(
    "Trop de tentatives. Réessayez plus tard.",
  );
});

test("unknown reset codes fall back to reset-specific copy", () => {
  expect(mapPasswordResetError("auth/internal-error")).toBe(
    "L’envoi du lien de réinitialisation a échoué. Veuillez réessayer.",
  );
});
