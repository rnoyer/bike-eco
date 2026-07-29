import { expect, test } from "@jest/globals";

import { tokens } from "@/theme/tokens";

test("exposes the b2c-derived palette and metrics", () => {
  expect(tokens.colors.primary).toBe("#111");
  expect(tokens.colors.muted).toBe("#71727A");
  expect(tokens.colors.border).toBe("#E5E7EB");
  expect(tokens.radius.md).toBe(12);
  expect(tokens.button.height).toBe(52);
  expect(tokens.space.lg).toBe(24);
});

test("exposes semantic feedback and status colours", () => {
  expect(tokens.colors.danger).toBe("#9F0712");
  expect(tokens.colors.success).toBe("#16A34A");
  expect(tokens.colors.surfaceAlt).toBe("#FAFAFA");
  expect(tokens.status.a_traiter).toEqual({ bg: "#FEF3C7", fg: "#92400E" });
  expect(tokens.status.en_cours).toEqual({ bg: "#DBEAFE", fg: "#1E40AF" });
  expect(tokens.status.cloture).toEqual({ bg: "#DCFCE7", fg: "#166534" });
});
