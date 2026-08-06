import { expect, test } from "@jest/globals";

import { tokens } from "@/theme/tokens";

test("exposes the b2c-derived palette and metrics", () => {
  expect(tokens.colors.primary).toBe("#2A2933");
  expect(tokens.colors.muted).toBe("#71727A");
  expect(tokens.colors.border).toBe("#E5E7EB");
  expect(tokens.radius.md).toBe(12);
  expect(tokens.button.height).toBe(52);
  expect(tokens.space.lg).toBe(24);
});

test("exposes the logo-derived brand colours", () => {
  expect(tokens.colors.brand).toBe("#1FC61B");
  expect(tokens.colors.brandTint).toBe("#E7F7E6");
  expect(tokens.colors.brandPressed).toBe("#17A814");
});

test("exposes semantic feedback and status colours", () => {
  expect(tokens.colors.danger).toBe("#9F0712");
  expect(tokens.colors.success).toBe("#16A34A");
  expect(tokens.colors.surfaceAlt).toBe("#FAFAFA");
  expect(tokens.status.a_traiter).toEqual({ bg: "#FEF3C7", fg: "#92400E" });
  expect(tokens.status.en_cours).toEqual({ bg: "#DBEAFE", fg: "#1E40AF" });
  expect(tokens.status.cloture).toEqual({ bg: "#DCFCE7", fg: "#166534" });
});
