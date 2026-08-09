import HeaderBackButton from "@/components/ui/HeaderBackButton";
import {
  type Href,
  type NativeStackNavigationOptions,
  router,
  useGlobalSearchParams,
  useSegments,
} from "expo-router";

import {
  B2B_TABS,
  BACKOFFICE_TABS,
  b2bDossierTabs,
  backofficeDossierTabs,
  type TabConfig,
} from "./tabs";

/**
 * Header config for the screens that are themselves `NativeTabs` navigators nested
 * inside a group `Stack` (the main `(tabs)` and each `dossier/[id]`). A native tab
 * switch does NOT re-run the parent Stack's `options` function, so we instead read
 * the focused route reactively from the router (`useSegments`) in the group
 * `_layout` and hand the Stack fresh option objects on every change.
 */
type Group = "(b2b)" | "(backoffice)";

/**
 * Header titles. Deliberately *not* derived from the tab labels in `tabs.ts`:
 * the specs give the header and the tab different copy for the same screen
 * ("Mon Compte" in `page-my-account.md` / `component-navbar.md` versus
 * "Mon compte" in `component-tab-bar.md`). Keep the two tables apart.
 */
const TABS_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  account: "Mon Compte",
  settings: "Paramètres",
};

const DOSSIER_TITLES: Record<string, string> = {
  index: "Dossier",
  chat: "Messages",
  management: "Statut dossier",
};

/** Destinations come from the tab configs, so a moved route updates both. */
const hrefOf = (tabs: TabConfig[], name: string): Href =>
  tabs.find((t) => t.name === name)!.href;

const DASHBOARD_HREF: Record<Group, Href> = {
  "(b2b)": hrefOf(B2B_TABS, "dashboard"),
  "(backoffice)": hrefOf(BACKOFFICE_TABS, "dashboard"),
};

const DOSSIER_HREF: Record<Group, (id: string) => Href> = {
  "(b2b)": (id) => hrefOf(b2bDossierTabs(id), "index"),
  "(backoffice)": (id) => hrefOf(backofficeDossierTabs(id), "index"),
};

interface GroupHeaders {
  tabs: NativeStackNavigationOptions;
  dossier: NativeStackNavigationOptions;
}

/**
 * Title + left arrow for the `(tabs)` and `dossier/[id]` screens, derived from the
 * focused tab. Secondary tabs get a `headerLeft` that switches tabs (Mon Compte /
 * Paramètres → Dashboard, Messages / Statut dossier → Dossier) — the destination is
 * a sibling tab, not a stack pop, so the native back button can't be reused.
 */
export function useGroupHeaders(group: Group): GroupHeaders {
  const segments = useSegments();
  const { id } = useGlobalSearchParams<{ id: string }>();
  const leaf = segments[segments.length - 1] ?? "";

  const tabs: NativeStackNavigationOptions = {
    title: TABS_TITLES[leaf] ?? "Dashboard",
    headerBackVisible: false,
    headerLeft:
      leaf === "account" || leaf === "settings"
        ? () => (
            <HeaderBackButton
              onPress={() => router.navigate(DASHBOARD_HREF[group])}
            />
          )
        : undefined,
  };

  // The dossier index route surfaces as the dynamic "[id]" segment.
  const dossierLeaf = leaf === "[id]" ? "index" : leaf;
  const dossier: NativeStackNavigationOptions = {
    title: DOSSIER_TITLES[dossierLeaf] ?? "Dossier",
    headerLeft:
      dossierLeaf === "chat" || dossierLeaf === "management"
        ? () => (
            <HeaderBackButton
              onPress={() => router.navigate(DOSSIER_HREF[group](id ?? ""))}
            />
          )
        : undefined,
  };

  return { tabs, dossier };
}
