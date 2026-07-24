# SectionWrapper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pure padding/gap layout container `SectionWrapper` and adopt it on all six section-bearing screens so the screen padding + inter-block gap is defined once.

**Architecture:** `SectionWrapper` is a non-scrolling `View` with `{ padding: tokens.space.lg, gap: tokens.space.xl }`. Each screen keeps its own `ScrollView`/`View`, removes padding+gap from its own container style, and wraps its block-level children (Sections, fields, banners, CTAs, headings) in `<SectionWrapper>`. Because it does not scroll, it nests anywhere — including inside DossierDetail's `ScrollView` alongside a full-bleed `PhotoCarousel`.

**Tech Stack:** React Native + Expo (SDK 56), TypeScript, Expo Router. Design tokens in `src/theme/tokens.ts`.

## Global Constraints

- Canonical spacing: **padding `tokens.space.lg`, gap `tokens.space.xl`** — copied verbatim into `SectionWrapper`; nowhere else re-declares them.
- These are **presentational RN components with no render-test harness** (jest covers schemas/data/auth only). TDD red/green does not apply; the per-task verification is `npx tsc --noEmit && npx expo lint`, with the full `npx jest` suite (must stay 123/123) run once at the end. Show the exact end-state code for every edit — no diffs-by-description.
- UI copy stays in French, unchanged. No behavior/data/logic changes.
- Do **not** merge or push. The branch `feat/back-office-validation-UI` is being manually tested; stop at the end for user review.
- Overlays (the company-detail `Modal`) and full-bleed media (DossierDetail `PhotoCarousel`) stay **outside** `SectionWrapper`.

---

## File Structure

- **Create** `src/components/ui/SectionWrapper.tsx` — the layout container (one responsibility: screen padding + inter-block gap).
- **Create** `docs/specs/component-section-wrapper.md` — its spec; cross-linked from `component-section.md`.
- **Modify** `docs/specs/component-section.md` — one cross-link line.
- **Modify** 6 screens: `DashboardScreen.tsx`, `(backoffice)/companies/index.tsx`, `(backoffice)/companies/[id].tsx`, `AccountScreen.tsx`, `SettingsScreen.tsx` + `SettingsList.tsx`, `DossierDetailScreen.tsx`.

---

## Task 1: `SectionWrapper` component + spec

**Files:**
- Create: `src/components/ui/SectionWrapper.tsx`
- Create: `docs/specs/component-section-wrapper.md`
- Modify: `docs/specs/component-section.md`

**Interfaces:**
- Produces: `export default function SectionWrapper({ children }: { children: ReactNode })` — a non-scrolling `View` styled `{ padding: tokens.space.lg, gap: tokens.space.xl }`. Consumed by every task below.

- [ ] **Step 1: Create the component**

`src/components/ui/SectionWrapper.tsx`:

```tsx
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { tokens } from "@/theme/tokens";

export default function SectionWrapper({ children }: { children: ReactNode }) {
  return <View style={styles.wrapper}>{children}</View>;
}

const styles = StyleSheet.create({
  wrapper: { padding: tokens.space.lg, gap: tokens.space.xl },
});
```

- [ ] **Step 2: Create the spec doc**

`docs/specs/component-section-wrapper.md`:

```markdown
# `SectionWrapper` layout container

A non-scrolling layout `View` that owns the app's canonical screen padding and the vertical
gap between top-level blocks. It is the single source of truth for that spacing, so screens
no longer re-declare `padding`/`gap` on their own `ScrollView`.

## Props

- `children: ReactNode` — any block-level content: `Section`s, form fields (e.g. the Settings
  région `Dropdown`), banners, CTAs, headings. Direct children are spaced by the shared gap.

## Layout

- `{ padding: tokens.space.lg, gap: tokens.space.xl }`. No other style/props (YAGNI).
- **Does not scroll** — it is a `View`, so it nests anywhere: each screen keeps its own
  `ScrollView`/`View` and drops padding+gap from that container. This is what lets
  DossierDetail keep a full-bleed `PhotoCarousel` (outside the wrapper) above padded content.

## Not for

- Overlays/`Modal`s and full-bleed media stay outside the wrapper so they don't inherit its
  padding/gap. It wraps the in-flow, stacked content only.
```

- [ ] **Step 3: Cross-link from the Section spec**

In `docs/specs/component-section.md`, append to the end of the file:

```markdown

## Layout

Sections are spaced by the [`SectionWrapper`](component-section-wrapper.md) container, which
owns the screen padding and the gap between sections and other top-level blocks.
```

- [ ] **Step 4: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors (the component is not yet imported anywhere — that is fine).

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/SectionWrapper.tsx docs/specs/component-section-wrapper.md docs/specs/component-section.md
git commit -m "feat(ui): SectionWrapper layout container + spec"
```

---

## Task 2: Adopt in the four already-`xl` screens

The homogeneous transform: wrap the `ScrollView`'s children in `<SectionWrapper>` and remove `padding`/`gap` from the `content` style. A reviewer accepts/rejects these four together.

**Files:**
- Modify: `src/components/screens/DashboardScreen.tsx`
- Modify: `src/app/(backoffice)/companies/index.tsx`
- Modify: `src/app/(backoffice)/companies/[id].tsx`
- Modify: `src/components/screens/AccountScreen.tsx`

**Interfaces:**
- Consumes: `SectionWrapper` (Task 1).

- [ ] **Step 1: DashboardScreen — import**

In `src/components/screens/DashboardScreen.tsx`, add the import (below the `DossiersSection` import):

```tsx
import DossiersSection from "@/components/ui/DossiersSection";
import PendingCompaniesBanner from "@/components/ui/PendingCompaniesBanner";
import SectionWrapper from "@/components/ui/SectionWrapper";
```

- [ ] **Step 2: DashboardScreen — wrap both role branches**

Replace the back-office `return (...)` block's `<ScrollView>...</ScrollView>` body so `SectionWrapper` wraps the banner + sections:

```tsx
    return (
      <ScrollView>
        <SectionWrapper>
          {onOpenCompanies ? <PendingCompaniesBanner onPress={onOpenCompanies} /> : null}
          <DossiersSection
            title="Dossiers à traiter"
            dossiers={aTraiter.data}
            loading={aTraiter.loading}
            emptyMessage="Vous n'avez pas de dossier à traiter pour le moment."
            renderCard={card}
          />
          <DossiersSection
            title="Dossiers en cours"
            dossiers={enCours.data}
            loading={enCours.loading}
            emptyMessage="Vous n'avez pas de dossier en cours pour le moment."
            renderCard={card}
          />
          <DossiersSection
            title="Dossiers clos"
            dossiers={closed.data}
            loading={closed.loading}
            emptyMessage="Vous n'avez pas de dossier clos pour le moment."
            renderCard={card}
          />
        </SectionWrapper>
      </ScrollView>
    );
```

Replace the B2C `return (...)` block's body the same way (CTA + two sections inside `SectionWrapper`):

```tsx
  return (
    <ScrollView>
      <SectionWrapper>
        <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={onSell}>
          <Text style={styles.ctaText}>Vendre une moto</Text>
        </TouchableOpacity>
        <DossiersSection
          title="Dossiers en cours"
          dossiers={ongoing}
          loading={aTraiter.loading || enCours.loading}
          emptyMessage="Vous n'avez pas de dossier en cours pour le moment."
          renderCard={card}
        />
        <DossiersSection
          title="Dossiers clos"
          dossiers={closed.data}
          loading={closed.loading}
          emptyMessage="Vous n'avez pas de dossier clos pour le moment."
          renderCard={card}
        />
      </SectionWrapper>
    </ScrollView>
  );
```

- [ ] **Step 3: DashboardScreen — drop the `content` style**

Update the `StyleSheet.create` block to remove the now-unused `content` key (keep `cta`/`ctaText`):

```tsx
const styles = StyleSheet.create({
  cta: {
    height: tokens.button.height,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { color: tokens.colors.primaryText, fontSize: 16, fontWeight: "700" },
});
```

- [ ] **Step 4: companies/index.tsx — full end state**

Replace `src/app/(backoffice)/companies/index.tsx` entirely with:

```tsx
import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import CompaniesSection from "@/components/ui/CompaniesSection";
import CompanyCard from "@/components/ui/CompanyCard";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useCompanies } from "@/lib/data/useCompanies";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

export default function CompaniesListScreen() {
  const router = useRouter();
  const { region } = useRegionFilter();
  const pending = useCompanies("pending", region);
  const active = useCompanies("active", region);

  const card = (c: WithId<Company>) => (
    <CompanyCard
      key={c.id}
      title={c.name}
      subtitle={c.createdByName}
      onManage={() => router.push(`/(backoffice)/companies/${c.id}`)}
    />
  );

  return (
    <ScrollView>
      <SectionWrapper>
        <CompaniesSection
          title="Vendeurs à valider"
          companies={pending.data}
          loading={pending.loading}
          emptyMessage="Pas de vendeur a valider pour le moment."
          renderCard={card}
        />
        <CompaniesSection
          title="Vendeurs enregistrées"
          companies={active.data}
          loading={active.loading}
          emptyMessage="Pas de vendeur enregistrée pour le moment."
          renderCard={card}
        />
      </SectionWrapper>
    </ScrollView>
  );
}
```

(Note: the `tokens` import is dropped here because the `content` style is gone.)

- [ ] **Step 5: companies/[id].tsx — import**

In `src/app/(backoffice)/companies/[id].tsx`, add below the `Section` import:

```tsx
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
```

- [ ] **Step 6: companies/[id].tsx — wrap content, keep Modal outside**

In the main `return`, change the opening tag to a bare `<ScrollView>` (the `content` style is deleted in Step 7), wrap all the in-flow `Section`s in `<SectionWrapper>`, and leave the `<Modal>` as a direct child of the `ScrollView` after the wrapper. The structure becomes:

```tsx
  return (
    <ScrollView>
      <SectionWrapper>
        {isPending ? (
          <Section title="Voulez-vous autoriser cette entreprise à vendre des véhicules">
            <View style={styles.row}>
              <Button
                label="Autoriser"
                onPress={() => run(() => callApproveCompany(id))}
                style={styles.flex}
                disabled={busy}
              />
              <Button
                variant="outlined"
                label="Décliner inscription"
                onPress={onDecline}
                style={styles.flex}
                disabled={busy}
              />
            </View>
          </Section>
        ) : null}

        <Section title="Information vendeur">
          <CompanyInfoList company={company.data} />
        </Section>

        {owner ? (
          <Section title="Information vendeur admin">
            <AccountInfoList user={owner} />
          </Section>
        ) : null}

        {!isPending ? (
          <>
            <Section
              title="Autres utilisateurs de cette entreprise"
              emptyMessage="Aucun autre utilisateur."
            >
              {otherUsers.map((u) => (
                <Text
                  key={u.id}
                  style={styles.userLine}
                >{`${u.prenom} ${u.nom} — ${u.email}`}</Text>
              ))}
            </Section>
            <Section title="Gérer cette entreprise">
              <Button
                variant="outlined"
                label="Supprimer cette entreprise"
                onPress={() => setConfirmDelete(true)}
                style={styles.danger}
                disabled={busy}
              />
            </Section>
          </>
        ) : null}
      </SectionWrapper>

      <Modal
        visible={confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Supprimer cette entreprise ?</Text>
            <Text style={styles.modalBody}>
              Cette action supprime définitivement l&apos;entreprise, ses
              utilisateurs, tous ses dossiers, les conversations et les
              documents stockés.
            </Text>
            <Button
              label="Annuler"
              onPress={() => setConfirmDelete(false)}
              disabled={busy}
            />
            <Button
              variant="text"
              label="Supprimer tout"
              onPress={() => {
                setConfirmDelete(false);
                void run(() => callDeleteCompany(id));
              }}
              style={styles.danger}
              disabled={busy}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
```

- [ ] **Step 7: companies/[id].tsx — drop the `content` style**

The bare `<ScrollView>` from Step 6 no longer references `styles.content`, so delete the `content` entry from the style block (keep `center`, `row`, `flex`, `userLine`, `danger`, `backdrop`, `modal`, `modalTitle`, `modalBody`):

```tsx
const styles = StyleSheet.create({
  center: {
    flex: 1,
    textAlignVertical: "center",
    textAlign: "center",
    padding: tokens.space.xl,
  },
  row: { flexDirection: "row", gap: tokens.space.md },
  flex: { flex: 1 },
  userLine: { fontSize: 14, color: tokens.colors.primary },
  danger: { alignSelf: "flex-start" },
  backdrop: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "center",
    padding: tokens.space.lg,
  },
  modal: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radius.md,
    padding: tokens.space.lg,
    gap: tokens.space.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
  modalBody: { fontSize: 14, color: tokens.colors.muted },
});
```

(The `center` style is used by the early loading/`introuvable` returns, which stay as-is.)

- [ ] **Step 8: AccountScreen.tsx — full end state**

Replace `src/components/screens/AccountScreen.tsx` entirely with:

```tsx
import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useAccount } from "@/lib/data/useAccount";
import { useCompany } from "@/lib/data/useCompanies";
import { useSession } from "@/lib/data/useSession";
import { Alert, ScrollView } from "react-native";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  const company = useCompany(data?.companyId ?? "");
  const { signOut } = useSession();
  if (loading || !data) return null; // guard shows briefly; layout splash covers first paint
  return (
    <ScrollView>
      <SectionWrapper>
        <Section title="Mes informations personnelles">
          <AccountInfoList user={data} />
        </Section>
        {data.companyId && company.data ? (
          <Section title={`Informations ${company.data.name}`}>
            <CompanyInfoList
              company={company.data}
              showName={false}
              showRegion={false}
            />
          </Section>
        ) : null}
        <Section title="Actions sur mon compte">
          <Button variant="primary" label="Se déconnecter" onPress={signOut} />
          <Button
            variant="outlined"
            label="Supprimer mon compte"
            onPress={() =>
              Alert.alert(
                "Supprimer mon compte",
                "Action non disponible pour le moment.",
              )
            }
          />
        </Section>
      </SectionWrapper>
    </ScrollView>
  );
}
```

(Note: `StyleSheet` and `tokens` imports are dropped — the `content` style is gone.)

- [ ] **Step 9: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors. (Watch for unused-import lint errors — confirm `tokens`/`StyleSheet` were removed where the plan says.)

- [ ] **Step 10: Commit**

```bash
git add src/components/screens/DashboardScreen.tsx "src/app/(backoffice)/companies/index.tsx" "src/app/(backoffice)/companies/[id].tsx" src/components/screens/AccountScreen.tsx
git commit -m "feat(ui): adopt SectionWrapper in dashboard, companies, account screens"
```

---

## Task 3: Settings (`SettingsList` returns the wrapper)

The Settings field (région `Dropdown`) must be a direct child of the wrapper so it shares the `xl` gap. `SettingsList` returns `<SectionWrapper>` instead of its own `container` `View`; `SettingsScreen` drops its `ScrollView` padding.

**Files:**
- Modify: `src/components/form/SettingsList.tsx`
- Modify: `src/components/screens/SettingsScreen.tsx`

**Interfaces:**
- Consumes: `SectionWrapper` (Task 1), `Section` (already imported in `SettingsList`).

- [ ] **Step 1: SettingsList.tsx — full end state**

Replace `src/components/form/SettingsList.tsx` entirely with:

```tsx
import Dropdown from "@/components/form/Dropdown";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import type { UserRole } from "@/lib/firestore/schema";
import {
  REGION_OPTIONS,
  fromRegion,
  toRegion,
} from "@/lib/navigation/regionOptions";

const REGION_LABELS = REGION_OPTIONS.map((o) => o.label);

interface Props {
  role: UserRole;
  onInvite: () => void;
  onManageCompanies?: () => void;
}

export default function SettingsList({
  role,
  onInvite,
  onManageCompanies,
}: Props) {
  const { region, setRegion } = useRegionFilter();
  const currentLabel =
    REGION_OPTIONS.find((o) => o.value === fromRegion(region))?.label ?? null;

  return (
    <SectionWrapper>
      {role === "backoffice" ? (
        <Dropdown
          label="Région gérée"
          options={REGION_LABELS}
          value={currentLabel}
          onChange={(label) => {
            const option = REGION_OPTIONS.find((o) => o.label === label);
            if (option) setRegion(toRegion(option.value));
          }}
        />
      ) : null}
      {role === "backoffice" ? (
        <Section title="Gestion des entreprises">
          <Button
            variant="outlined"
            label="Ajouter/Supprimer une entreprises"
            onPress={() => onManageCompanies?.()}
          />
        </Section>
      ) : null}
      <Section title="Gestion des membres">
        <Button
          variant="outlined"
          label="Inviter un collègue"
          onPress={onInvite}
        />
      </Section>
    </SectionWrapper>
  );
}
```

(Note: the région `Dropdown` was previously wrapped in a redundant `<>...</>` fragment; it is now a direct child. `StyleSheet`, `View`, `tokens` imports are dropped.)

- [ ] **Step 2: SettingsScreen.tsx — full end state**

Replace `src/components/screens/SettingsScreen.tsx` entirely with:

```tsx
import SettingsList from "@/components/form/SettingsList";
import type { UserRole } from "@/lib/firestore/schema";
import { ScrollView } from "react-native";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onManageCompanies?: () => void;
}

export default function SettingsScreen({
  role,
  onInvite,
  onManageCompanies,
}: Props) {
  return (
    <ScrollView>
      <SettingsList
        role={role}
        onInvite={onInvite}
        onManageCompanies={onManageCompanies}
      />
    </ScrollView>
  );
}
```

(Note: `StyleSheet` and `tokens` imports are dropped — the `content` style moved into `SectionWrapper`.)

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/form/SettingsList.tsx src/components/screens/SettingsScreen.tsx
git commit -m "feat(ui): SettingsList renders SectionWrapper (shared gap for field + sections)"
```

---

## Task 4: DossierDetail (carousel outside, wrapper inside)

The full-bleed `PhotoCarousel` stays a direct child of the `ScrollView`; the heading + Informations `Section` move into `SectionWrapper` (replacing the bespoke `list` `View`).

**Files:**
- Modify: `src/components/screens/DossierDetailScreen.tsx`

**Interfaces:**
- Consumes: `SectionWrapper` (Task 1), `Section` (already imported).

- [ ] **Step 1: Full end state**

Replace `src/components/screens/DossierDetailScreen.tsx` entirely with:

```tsx
import { ActivityIndicator, ScrollView, StyleSheet, Text } from "react-native";
import DossierInfoList from "@/components/native/DossierInfoList";
import PhotoCarousel from "@/components/ui/PhotoCarousel";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useDossier } from "@/lib/data/useDossier";
import { tokens } from "@/theme/tokens";

export default function DossierDetailScreen({ id }: { id: string }) {
  const { data, loading } = useDossier(id);
  return (
    <ScrollView>
      {loading || !data ? (
        <ActivityIndicator style={styles.spinner} color={tokens.colors.primary} />
      ) : (
        <>
          <PhotoCarousel photos={data.photos} status={data.status} />
          <SectionWrapper>
            <Text style={styles.heading}>
              {data.vehicle.marque} {data.vehicle.modele}
            </Text>
            <Section title="Informations">
              <DossierInfoList dossier={data} />
            </Section>
          </SectionWrapper>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  spinner: { paddingVertical: 48 },
  heading: { ...tokens.text.title },
});
```

(Note: the `View` import and the `content`/`list` styles are dropped; the carousel is full-bleed as a direct `ScrollView` child, and the wrapper provides the padding + heading→section gap.)

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx expo lint`
Expected: no errors.

- [ ] **Step 3: Run the full jest suite**

Run: `npx jest`
Expected: `Test Suites: 24 passed`, `Tests: 123 passed` (unchanged — no test touches these components).

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/DossierDetailScreen.tsx
git commit -m "feat(ui): DossierDetail uses SectionWrapper (full-bleed carousel outside)"
```

---

## Final checkpoint

- [ ] Confirm the three suites are green: `npx tsc --noEmit && npx expo lint && npx jest`.
- [ ] **Stop for user review.** Do not merge or push. Note for the user: the auth-related working-tree changes (`signin.tsx`, `ThirdPartyAuthButtons.tsx`, `test-auth.md`) and untracked `assets/images/icons/` are pre-existing and remain unstaged. Optional manual emulator check (bo@bike-eco.fr / password123): every screen keeps consistent `xl` spacing; DossierDetail's carousel is still full-bleed and scrolls with the content; Settings' blocks are now `xl`-spaced.

---

## Self-Review

**Spec coverage:**
- Pure `View` padding/gap container → Task 1. ✓
- Owns `padding lg` + `gap xl`, screens drop their own → Tasks 2–4. ✓
- Holds any block child (Sections, fields, banners, CTAs, headings) → Dashboard banner/CTA (Task 2), Settings Dropdown (Task 3), Dossier heading (Task 4). ✓
- All six screens adopt it → Tasks 2 (four), 3 (Settings), 4 (Dossier). ✓
- DossierDetail carousel outside, scrolls with content, no pinning → Task 4. ✓
- Company-detail Modal outside the wrapper → Task 2 Step 6. ✓
- Settings `md`→`xl` → Task 3. ✓
- Spec docs (`component-section-wrapper.md` + cross-link) → Task 1. ✓

**Placeholder scan:** No TBD/TODO; every code step shows full end-state code. ✓

**Type consistency:** `SectionWrapper({ children }: { children: ReactNode })` defined in Task 1 and consumed identically (single `children`, no other props) in Tasks 2–4. Dropped imports (`StyleSheet`, `tokens`, `View`) are called out per file to avoid unused-import lint failures. ✓
