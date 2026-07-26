/** Design tokens extracted from the b2c StyleSheets — the one source of truth
 *  for the RN-fallback components. @expo/ui screens use native styling. */
export const tokens = {
  colors: {
    primary: "#111",
    primaryText: "#FFFFFF",
    muted: "#71727A",
    border: "#E5E7EB",
    divider: "#F3F4F6",
    disabled: "#C1C1C6", // also the text-input placeholder colour
    surfaceAlt: "#FAFAFA", // input / media-button fill
    surface: "#FFFFFF",
    bg: "#FFFFFF",
    // Semantic feedback colours — single source for errors/success across the app.
    danger: "#DC2626",
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
    title: { fontSize: 24, fontWeight: "bold" as const, color: "#111" },
    subtitle: { fontSize: 14, fontWeight: "400" as const, color: "#71727A" },
  },
} as const;

export type Tokens = typeof tokens;
