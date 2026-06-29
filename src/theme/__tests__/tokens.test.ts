import { tokens } from "@/theme/tokens";

test("exposes the b2c-derived palette and metrics", () => {
  expect(tokens.colors.primary).toBe("#111");
  expect(tokens.colors.muted).toBe("#71727A");
  expect(tokens.colors.border).toBe("#E5E7EB");
  expect(tokens.radius.md).toBe(12);
  expect(tokens.button.height).toBe(52);
  expect(tokens.space.lg).toBe(24);
});
