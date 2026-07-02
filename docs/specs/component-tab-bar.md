# Tab bar (bottom)

Implemented with `expo-router` NativeTabs (`expo-router/unstable-native-tabs`) — a real
native bottom tab bar (UITabBar on iOS, BottomNavigation on Android). Defined per context
in a `(tabs)/_layout.tsx` or `dossier/[id]/_layout.tsx`.

Each tab is a `<NativeTabs.Trigger name="<route>">` with:
- `<NativeTabs.Trigger.Icon sf="<SF Symbol>" md="<Material icon>" />` (cross-platform)
- `<NativeTabs.Trigger.Label>` (title)

Contexts:
- App level (B2B & BO): Dashboard · Mon compte · Paramètres.
- Dossier level (B2B): Dossier · Messages.
- Dossier level (BO): Dossier · Messages · Statut dossier.
