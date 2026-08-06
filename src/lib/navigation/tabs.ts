import type { Href } from "expo-router";
import type { AndroidSymbol } from "expo-symbols";
import type { ImageSourcePropType } from "react-native";
import type { SFSymbol } from "sf-symbols-typescript";

import buildingIcon from "@/assets/images/icons/building.svg";
import folderOpenIcon from "@/assets/images/icons/folder_open.svg";
import gridViewIcon from "@/assets/images/icons/grid_view.svg";
import mailIcon from "@/assets/images/icons/mail.svg";
import personIcon from "@/assets/images/icons/person.svg";
import twoWheelerIcon from "@/assets/images/icons/two_wheeler.svg";

/**
 * The tab sets, shared by both renderers so the two platforms can't drift.
 *
 * Native renders these through `NativeTabs` (`sf` / `md` symbols); web renders them
 * through `expo-router/ui` (`icon` / `href`). Web needs its own icon asset because
 * expo-router's web tab renderer emits the label only and drops `sf` / `md` entirely.
 */
export interface TabConfig {
  /** Route segment, matching the file name inside the tab group. */
  name: string;
  /** French label shown on the tab. */
  label: string;
  /** SF Symbol, iOS. */
  sf: SFSymbol;
  /** Material Symbol, Android. */
  md: AndroidSymbol;
  /** SVG asset, web — `sf` / `md` are not rendered there. */
  icon: ImageSourcePropType;
  /** Absolute href, web — `TabTrigger` inside a `TabList` requires one. */
  href: Href;
}

type Group = "(b2b)" | "(backoffice)";

/** Dashboard · Mon compte · Paramètres — the app-level tabs, identical for both roles. */
function appTabs(group: Group): TabConfig[] {
  return [
    {
      name: "dashboard",
      label: "Dashboard",
      sf: "square.grid.2x2.fill",
      md: "grid_view",
      icon: gridViewIcon,
      href: `/${group}/(tabs)/dashboard`,
    },
    {
      name: "account",
      label: "Mon compte",
      sf: "person.fill",
      md: "person",
      icon: personIcon,
      href: `/${group}/(tabs)/account`,
    },
    {
      name: "settings",
      label: "Paramètres",
      sf: "building.fill",
      md: "corporate_fare",
      icon: buildingIcon,
      href: `/${group}/(tabs)/settings`,
    },
  ];
}

export const B2B_TABS = appTabs("(b2b)");
export const BACKOFFICE_TABS = appTabs("(backoffice)");

/**
 * Dossier-level tabs. The href carries the dossier id, so these are built per dossier
 * rather than declared as a constant.
 */
function dossierTabs(group: Group, id: string): TabConfig[] {
  return [
    {
      name: "index",
      label: "Dossier",
      sf: "bicycle",
      md: "two_wheeler",
      icon: twoWheelerIcon,
      href: `/${group}/dossier/${id}`,
    },
    {
      name: "chat",
      label: "Messages",
      sf: "envelope.fill",
      md: "mail",
      icon: mailIcon,
      href: `/${group}/dossier/${id}/chat`,
    },
  ];
}

export function b2bDossierTabs(id: string): TabConfig[] {
  return dossierTabs("(b2b)", id);
}

/** The back office adds the status/price management tab. */
export function backofficeDossierTabs(id: string): TabConfig[] {
  return [
    ...dossierTabs("(backoffice)", id),
    {
      name: "management",
      label: "Statut dossier",
      sf: "folder.fill",
      md: "folder_open",
      icon: folderOpenIcon,
      href: `/(backoffice)/dossier/${id}/management`,
    },
  ];
}
