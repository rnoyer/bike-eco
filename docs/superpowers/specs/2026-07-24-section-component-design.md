# Generic `Section` component — design + implementation handoff

**Date:** 2026-07-24 · **Branch:** `feat/back-office-validation-UI` · **Status:** Approved (brainstorm) — ready to implement

> **This is a session handoff.** The design below is approved. Implement it directly
> (small change — ~6 files), then stop at a checkpoint for the user to review. Do **not**
> merge/push — the user is manually testing the branch first (see Environment).

## Goal

Add a generic `Section` UI component (very similar to `DossiersSection`) and use it to wrap
the "pseudo-sections" (inline `<Text sectionTitle>` + content blocks) across several screens,
plus refactor the two existing list-section components to reuse it. One source of truth for
the section title / loading / empty CSS + behavior.

## Locked decisions (from brainstorm)

1. **Refactor `DossiersSection` + `CompaniesSection` to wrap the new `Section`** (single source
   of truth; the dashboards + BO companies list must look identical afterward).
2. **Dossier screen:** keep the vehicle-name heading (`tokens.text.title`) as-is; add a
   `Section` titled **"Informations"** around the info list (a second title line is fine).
3. **Empty = no children** (`React.Children.count(children) === 0`). Props are `title`,
   `loading?`, `emptyMessage?`, `children` — no `isEmpty` prop. Callers with a possibly-empty
   list pass the mapped array (`[]` → shows `emptyMessage`); always-present sections pass their
   content and omit `emptyMessage`.

## Design

### New `src/components/ui/Section.tsx`

Props `{ title: string; loading?: boolean; emptyMessage?: string; children?: ReactNode }`.
Render: the title; then `loading` → spinner; else `Children.count(children) === 0 && emptyMessage`
→ the empty text; else `<View style={list}>{children}</View>`. **CSS copied verbatim from the
current `DossiersSection`** (`section` = `{ gap: tokens.space.md }`, `title` =
`{ fontSize: 18, fontWeight: "700", color: tokens.colors.primary }`, `spinner` =
`{ paddingVertical: tokens.space.lg }`, `empty` = `{ fontSize: 14, color: tokens.colors.muted }`,
`list` = `{ gap: tokens.space.md }`).

```tsx
import { Children, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { tokens } from "@/theme/tokens";

interface Props {
  title: string;
  loading?: boolean;
  emptyMessage?: string;
  children?: ReactNode;
}

export default function Section({ title, loading, emptyMessage, children }: Props) {
  const isEmpty = Children.count(children) === 0;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      {loading ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : isEmpty && emptyMessage ? (
        <Text style={styles.empty}>{emptyMessage}</Text>
      ) : (
        <View style={styles.list}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.space.md },
  title: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
  spinner: { paddingVertical: tokens.space.lg },
  empty: { fontSize: 14, color: tokens.colors.muted },
  list: { gap: tokens.space.md },
});
```

> `Children.count` is reliable for our callers: an empty array child → `0`, a non-empty array
> → `N`, a single element → `1`. The mapped-list callers (dossiers/companies/other-users) are
> the only ones that use `emptyMessage`, and they pass `{items.map(...)}`.

### Refactor `src/components/ui/DossiersSection.tsx` and `CompaniesSection.tsx`

Keep their existing prop shapes (`title`, `dossiers`/`companies`, `loading`, `emptyMessage`,
`renderCard`). Replace their bodies with a thin wrapper:

```tsx
// DossiersSection
return (
  <Section title={title} loading={loading} emptyMessage={emptyMessage}>
    {dossiers.map(renderCard)}
  </Section>
);
```
```tsx
// CompaniesSection
return (
  <Section title={title} loading={loading} emptyMessage={emptyMessage}>
    {companies.map(renderCard)}
  </Section>
);
```
Delete the now-unused local `StyleSheet` from both files (the styles moved to `Section`). Keep
the `ReactNode`/`WithId`/type imports they still need.

### Wrap pseudo-sections (delete the duplicated local `section`/`sectionTitle` styles in each)

- **`src/components/screens/AccountScreen.tsx`** — replace the two inline `<Text sectionTitle>` +
  content blocks with `<Section title="Mon compte"><AccountInfoList user={data} /></Section>` and
  (inside the existing `data.companyId && company.data` guard)
  `<Section title={`Informations ${company.data.name}`}><CompanyInfoList company={company.data} showName={false} showRegion={false} /></Section>`.
  Remove the local `sectionTitle` style; keep the `content` container style.
- **`src/components/form/SettingsList.tsx`** — wrap the "Gestion des entreprises" (back-office)
  block and the "Gestion des membres" block each in a `<Section title=...>` around their
  `Button`(s). **Leave the "Région gérée" `Dropdown` as-is** (it is a labelled control, not a
  titled section). Remove the local `sectionTitle` style (keep `container`).
- **`src/app/(backoffice)/companies/[id].tsx`** — wrap each pseudo-section in `<Section>`:
  "Voulez-vous autoriser cette entreprise à vendre des véhicules" (children = the Autoriser/
  Décliner row), "Information vendeur" (`CompanyInfoList`), "Information vendeur admin"
  (`AccountInfoList`), "Autres utilisateurs de cette entreprise"
  (`<Section title="…" emptyMessage="Aucun autre utilisateur.">{otherUsers.map(u => <Text .../>)}</Section>`
  — this **replaces** the current manual `otherUsers.length === 0 ? … : …` check), and
  "Gérer cette entreprise" (the delete `Button`). Remove the local `section`/`sectionTitle`
  styles; keep the others (row/flex/danger/modal/etc.).
- **`src/components/screens/DossierDetailScreen.tsx`** — keep `<Text style={styles.heading}>{marque} {modele}</Text>`;
  wrap `<DossierInfoList dossier={data} />` in `<Section title="Informations">`. Keep the padded
  container around heading + section (the info list has no horizontal padding of its own).

### Spec sync (same change)

- Add a short `docs/specs/component-section.md` describing the component (props `title`,
  `loading`, `emptyMessage`, `children`; empty = no children; the shared title/loading/empty
  look).
- Add one line to `docs/specs/component-dossiers-section.md` noting it now wraps the generic
  `Section`.

## Verification

`npx tsc --noEmit && npx expo lint && npx jest` — all must pass. (No new unit tests required;
these are presentational components with no existing render tests. The refactor of
`DossiersSection`/`CompaniesSection` must not change their behavior — the dashboards and BO
companies list should look identical.)

Optional manual check (emulator + seed already running — see Environment): back-office login,
confirm the companies list, BO vendeur detail, account, settings, and a dossier all render their
titled sections correctly, and "Autres utilisateurs" shows "Aucun autre utilisateur." when a
company has only its owner.

## Process

Implement directly (the change is small and mechanical). Commit as one focused commit, e.g.
`feat(ui): generic Section component; wrap pseudo-sections across screens`. Then **stop and let
the user review** — do not merge or push (the branch is being manually tested first).

## Environment / branch state (as of handoff)

- Branch `feat/back-office-validation-UI`, off `main`. Carries **Slice 4b** (back-office company
  management) + the **location-model simplification** (company owns département/ville; user has
  no location). Both are complete, individually reviewed, passed final whole-branch reviews, and
  are **not merged** — the user is manually testing first.
- Latest known HEAD before this doc: `97ce9fa`. Suites green at that point: `tsc` clean, client
  jest **123/123**, functions jest **29/29**.
- A **persistent local Firebase emulator** is running (Auth 9099 / Firestore 8080 / Storage 9199)
  with a **fresh seed** loaded, for manual testing. Back-office login: **`bo@bike-eco.fr` /
  `password123`**. Launch the app with `EXPO_PUBLIC_USE_EMULATORS=1 npx expo start --dev-client`.
  Native `@expo/ui` info-lists mean the account/vendeur screens need a device/simulator, not web.
- The emulator `test:rules` suite has not been run recently (the persistent emulator holds the
  ports); it needs JDK 21+ — use `JAVA_HOME=/usr/local/jdk-26.0.1` with
  `npx firebase-tools@latest` (a global `firebase` on PATH resolves to an older JDK).
- Design docs for the two completed features:
  `docs/superpowers/specs/2026-07-24-back-office-company-management-design.md` and
  `2026-07-24-location-model-simplification-design.md`; data model in
  `docs/tech/firestore-data-model.md`.
