---
name: project-design-tokens
description: bike-eco shared UI styling vocabulary (buttons, titles, colors) defined in FormLayout
metadata:
  type: project
---

Canonical design tokens live in `src/components/form/FormLayout.tsx` (StyleSheet). Reuse these verbatim for consistency:
- Buttons: height 52, borderRadius 12, fontSize 16, fontWeight 600.
- Primary button: bg `#111`, text `#fff`. Secondary/outline: borderWidth 1.5, borderColor `#E5E7EB`, text `#111`.
- Title: fontSize 24, fontWeight bold, color `#111`. Subtitle: fontSize 14, color `#71727A`.
- Screen bg `#fff`; divider `#F3F4F6`.
- Safe areas via `useSafeAreaInsets()` from `react-native-safe-area-context` (dependency present).

**How to apply:** when building new screens, pull from these tokens rather than inventing values. Used in `src/app/index.tsx`.
