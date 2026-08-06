/** Design tokens extracted from the b2c StyleSheets — the one source of truth
 *  for every component's style. */
export const tokens = {
  colors: {
    // The logo's charcoal (assets/images/icon.png), not a pure neutral black.
    primary: "#2A2933",
    primaryText: "#FFFFFF",
    // Brand green, also from the logo. Spent only on affordances and identity
    // accents — a rule, a small fill, an active state — never on a large fill,
    // and never as a state colour (that stays `success` / `status`).
    // Only ever a background, never text: `brand` is ~2.3:1 on white, so green
    // type or a green glyph on a light surface needs a much darker green.
    brand: "#1FC61B",
    brandTint: "#E7F7E6", // pale green surface: placeholders, selected states
    brandPressed: "#17A814", // pressed state of a `brand`-filled control
    muted: "#71727A",
    border: "#E5E7EB",
    divider: "#F3F4F6",
    disabled: "#C1C1C6", // also the text-input placeholder colour
    surfaceAlt: "#FAFAFA", // input / media-button fill
    surface: "#FFFFFF",
    // Semantic feedback colours — single source for errors/success across the app.
    danger: "#9F0712",
    success: "#16A34A",
  },
  // Per-status badge palette (background + foreground), keyed by DossierStatus.
  status: {
    a_traiter: { bg: "#FEF3C7", fg: "#92400E" },
    en_cours: { bg: "#DBEAFE", fg: "#1E40AF" },
    cloture: { bg: "#DCFCE7", fg: "#166534" },
  },
  radius: { sm: 8, md: 12, lg: 16 },
  space: { xs: 4, sm: 8, md: 12, lg: 24, xl: 28 },
  button: { height: 52 },
  text: {
    title: { fontSize: 24, fontWeight: "bold" as const, color: "#2A2933" },
    subtitle: { fontSize: 14, fontWeight: "400" as const, color: "#71727A" },
  },
} as const;

export type Tokens = typeof tokens;
