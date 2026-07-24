# Location Model Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the **company** the single source of location (`département` + `ville` + derived `region`); remove `region`/`departement`/`ville` from `AppUser` and from Auth claims; derive a dossier's `region` from its company.

**Architecture:** Sequenced so the tree compiles and tests pass at every commit — add `Company.ville` first, migrate every consumer off user-level location (registration, dossier creation, account screen), and only then delete the fields from `AppUser` and the `region` claim. The back-office "Région gérée" local filter is untouched.

**Tech Stack:** Expo Router + React Native, Firebase (Auth + named `bike-eco-db` Firestore + Storage), 2nd-gen Cloud Functions (`onCall`), Zod v4, Jest.

## Global Constraints

- **`AppUser` has no location.** Location lives only on `Company` (`departement` + `ville` + derived `region`). A user keeps `role`, `companyId`, `nom`, `prenom`, `email`, `telephone`, `status`, timestamps.
- **Dossier `region`** is derived from `company.departement` at creation (BO-editable via the management form). The `region in ['NORTH','SOUTH']` create/update rule is unchanged.
- **Auth claims drop `region`.** The `Region` type, `region-store`, `useRegionFilter`, and `regionOptions` (the local "Région gérée" filter) are **untouched**.
- **Company registration requires `companyDepartement` + `companyVille`.** Invited users are **not** asked for location (their company already has it).
- Named DB in functions: `getFirestore(getApp(), "bike-eco-db")`. Claims server-set. French copy verbatim.
- **Not live → re-seed only, no migration script.** Existing dev data is re-seeded.
- TDD for pure logic; UI verified by `npx tsc --noEmit` + `npx expo lint`.

---

### Task 1: `Company` gains `ville`

**Files:**
- Modify: `src/lib/firestore/schema.ts`

**Interfaces:**
- Produces: `Company` has a `ville: string` field.

- [ ] **Step 1: Add the `ville` field**

In `src/lib/firestore/schema.ts`, in the `Company` interface, add `ville` right after `departement`:

```ts
  departement: string; // "33 - Gironde" — company location, captured at registration
  ville: string; // company city
  region: Region; // derived from departement; drives back-office routing
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (additive field; nothing reads it yet).

- [ ] **Step 3: Commit**

```bash
git add src/lib/firestore/schema.ts
git commit -m "feat(schema): add ville to Company"
```

---

### Task 2: Functions registration — company owns location

**Files:**
- Modify: `functions/src/registration/schemas.ts`
- Modify: `functions/src/registration/core.ts`
- Test: `functions/src/registration/core.test.ts`
- Test: `functions/src/registration/schemas.test.ts`

**Interfaces:**
- Consumes: `resolveRegion` from `../regions`.
- Produces: `registerCompany` writes `company.ville`; the user doc no longer has `region`/`departement`/`ville`; `companyDepartement` + `companyVille` are required.

- [ ] **Step 1: Trim the shared profile + require company location**

In `functions/src/registration/schemas.ts`, replace the `profile` object and `registerCompanySchema`:

```ts
const profile = {
  nom: z.string().trim().min(1),
  prenom: z.string().trim().min(1),
  telephone: z.string().regex(/^\d{10}$/),
};

// ... registerCredential / acceptCredential unchanged ...

export const registerCompanySchema = z
  .object({
    siret: z.string().regex(/^\d{14}$/),
    companyName: z.string().trim().min(1),
    companyDepartement: z.string().trim().min(1), // company location (step 1)
    companyVille: z.string().trim().min(1),
    ...profile,
  })
  .and(registerCredential);
```

(`acceptInviteSchema` is unchanged in shape — it already spreads `profile`, which is now trimmed.)

- [ ] **Step 2: Update the failing tests first (TDD)**

In `functions/src/registration/core.test.ts`:
- Replace the `companyInput` fixture with:
  ```ts
  const companyInput = {
    method: "password" as const, siret: "12345678901234", companyName: "Garage X",
    companyDepartement: "75 - Paris", companyVille: "Paris",
    nom: "Durand", prenom: "Camille", telephone: "0600000000",
    email: "c@x.fr", password: "password123",
  };
  ```
- In the first test ("creates pending company+user…"), change the company assertion to include `ville: "Paris"` and drop nothing else; change the **user** assertion so it does NOT expect `region`/`departement`/`ville`:
  ```ts
  expect(d.calls.companies["comp_new"]).toMatchObject({
    siret: "12345678901234", status: "pending", createdBy: "uid_new",
    departement: "75 - Paris", ville: "Paris", region: "NORTH",
    createdByName: "Camille Durand", validatedAt: null,
  });
  expect(d.calls.users["uid_new"]).toMatchObject({ role: "b2b", companyId: "comp_new", status: "pending" });
  ```
- In every `acceptInviteCore(...)` and `registerCompanyCore(...)` call in this file, **remove** the `departement: "75 - Paris"` and `ville: "Paris"` (or `"Marseille"` etc.) properties from the inline input object literals (they are no longer part of the input types — excess properties fail `tsc`).

In `functions/src/registration/schemas.test.ts`:
- In the **register** fixture, add `companyDepartement: "75 - Paris"` and `companyVille: "Paris"`, and remove `departement`/`ville`.
- In the **accept** fixture, remove `departement`/`ville`.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `cd functions && npx jest src/registration/core.test.ts src/registration/schemas.test.ts`
Expected: FAIL — the user doc still carries `departement`/`ville`, and the company doc lacks `ville`.

- [ ] **Step 4: Implement the core change**

In `functions/src/registration/core.ts`, replace `profileDoc` and the `writeCompany` block:

```ts
function profileDoc(input: { nom: string; prenom: string; telephone: string }, email: string, companyId: string, status: "pending" | "active") {
  return {
    role: "b2b", companyId,
    nom: input.nom, prenom: input.prenom, email,
    telephone: input.telephone,
    status,
  };
}
```

In `registerCompanyCore`, replace the `companyDepartement` derivation + `writeCompany` call:

```ts
  const companyId = deps.newCompanyId();
  await deps.writeCompany(companyId, {
    siret: input.siret,
    name: input.companyName,
    status: "pending",
    departement: input.companyDepartement,
    ville: input.companyVille,
    region: resolveRegion(input.companyDepartement),
    createdBy: uid,
    createdByName: `${input.prenom} ${input.nom}`,
    validatedAt: null,
  });
```

(`profileDoc` is called for both `registerCompanyCore` and `acceptInviteCore`; both now pass only `{ nom, prenom, telephone }` from `input`, which the trimmed types guarantee.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd functions && npx jest src/registration`
Expected: PASS.

- [ ] **Step 6: Build + lint**

Run: `cd functions && npm run build && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add functions/src/registration
git commit -m "feat(functions): company owns location; user doc drops region/departement/ville"
```

---

### Task 3: Client registration forms + payloads

**Files:**
- Modify: `src/lib/data/registration.ts`
- Modify: `src/features/b2b-registration/schema.ts`
- Modify: `src/features/b2b-registration/steps.tsx`
- Modify: `src/features/b2b-registration/submit.ts`
- Modify: `src/app/(auth)/register.tsx`
- Modify: `src/features/registration/fields.tsx`
- Modify: `src/features/b2b-invited-registration/schema.ts`
- Modify: `src/features/b2b-invited-registration/steps.tsx`
- Modify: `src/features/b2b-invited-registration/submit.ts`
- Modify: `src/app/(auth)/register-invited.tsx`
- Test: `src/features/b2b-registration/__tests__/schema.test.ts`
- Test: `src/features/b2b-invited-registration/__tests__/schema.test.ts`
- Modify (spec): `docs/specs/form-b2b-company-registration.md`, `docs/specs/form-b2b-invited-registration.md`

**Interfaces:**
- Produces: company registration collects `companyDepartement` + `companyVille` (step 1) and no user location; invited registration collects no location.

- [ ] **Step 1: Update the payload types**

In `src/lib/data/registration.ts`, edit `RegisterCompanyPayload` — add `companyVille`, make `companyDepartement` required, remove user `departement`/`ville`:

```ts
export interface RegisterCompanyPayload {
  method: "password" | "google";
  siret: string;
  companyName: string;
  companyDepartement: string;
  companyVille: string;
  nom: string;
  prenom: string;
  telephone: string;
  email?: string;
  password?: string;
}
export interface AcceptInvitePayload {
  method: "password" | "google";
  code: string;
  nom: string;
  prenom: string;
  telephone: string;
  password?: string;
}
```

- [ ] **Step 2: Company form schema**

In `src/features/b2b-registration/schema.ts`, replace the schema body so it has `companyDepartement` + `companyVille` and drops user `departement`/`ville`:

```ts
export const b2bCompanyRegistrationSchema = z.object({
  siret: z.string().regex(/^\d{14}$/, "Saisissez un numéro SIRET à 14 chiffres"),
  companyName: requiredText("Indiquez le nom de votre entreprise"),
  companyDepartement: requiredText("Sélectionnez le département de l'entreprise"),
  companyVille: requiredText("Indiquez la ville de l'entreprise"),
  email: z.email("Saisissez un email valide"),
  password: z.string().min(8, "8 caractères minimum"),
  nom: requiredText("Indiquez votre nom"),
  prenom: requiredText("Indiquez votre prénom"),
  telephone: z.string().regex(/^\d{10}$/, "Saisissez un numéro à 10 chiffres"),
});

export type B2bCompanyRegistrationForm = z.infer<typeof b2bCompanyRegistrationSchema>;

export const B2B_COMPANY_REGISTRATION_DEFAULTS: B2bCompanyRegistrationForm = {
  siret: "",
  companyName: "",
  companyDepartement: "",
  companyVille: "",
  email: "",
  password: "",
  nom: "",
  prenom: "",
  telephone: "",
};
```

- [ ] **Step 3: Company step-1 gains Ville; step-3 fields trimmed**

In `src/features/b2b-registration/steps.tsx`, add a `companyVille` text field to `EntrepriseFields` (after the `companyDepartement` dropdown) and update step 1's `fields`; update step 3's `fields` to drop `departement`/`ville`:

```tsx
function EntrepriseFields() {
  return (
    <>
      <ControlledField name="siret" label="Numéro SIRET *" placeholder="14 chiffres" keyboardType="numeric" maxLength={14} transform={digitsOnly(14)} returnKeyType="next" />
      <ControlledField name="companyName" label="Nom de votre entreprise *" placeholder="Nom de votre entreprise" autoCapitalize="words" returnKeyType="next" />
      <ControlledDropdown name="companyDepartement" label="Département *" placeholder="Département" options={DEPARTMENTS} searchable />
      <ControlledField name="companyVille" label="Ville *" placeholder="Ville de l'entreprise" autoCapitalize="words" returnKeyType="done" />
      <Text style={styles.note}>* Champs obligatoires</Text>
    </>
  );
}
```

Step 1 `fields`: `["siret", "companyName", "companyDepartement", "companyVille"]`.
Step 3 `fields`: `["nom", "prenom", "telephone"]`.

- [ ] **Step 4: Shared coordonnées fields drop location**

In `src/features/registration/fields.tsx`, remove the `departement` `ControlledDropdown` and the `ville` `ControlledField` from `CoordonneesFields` (leaving nom / prénom / téléphone + the note). Remove the now-unused `ControlledDropdown` and `DEPARTMENTS` imports from this file **if** nothing else there uses them (the account/Google fields don't).

- [ ] **Step 5: Company register screen — drop prefill, fix payloads**

In `src/app/(auth)/register.tsx`:
- Remove the prefill `useEffect` (the `companyDept` watch block) and drop `useEffect` from the React import (keep `useRef`, `useState`).
- In the Google-path `callRegisterCompany({...})`, replace `departement`/`ville` with `companyVille` (and keep `companyDepartement`):
  ```tsx
  await callRegisterCompany({
    method: "google",
    siret: values.siret,
    companyName: values.companyName,
    companyDepartement: values.companyDepartement,
    companyVille: values.companyVille,
    nom: values.nom,
    prenom: values.prenom,
    telephone: values.telephone,
  });
  ```

In `src/features/b2b-registration/submit.ts`, update the `callRegisterCompany({...})` object the same way (add `companyDepartement`/`companyVille`, drop `departement`/`ville`).

- [ ] **Step 6: Invited registration drops location**

In `src/features/b2b-invited-registration/schema.ts`, remove `departement`/`ville` from the schema object and the defaults.

In `src/features/b2b-invited-registration/steps.tsx`, change the coordonnées step `fields` to `["nom", "prenom", "telephone"]`.

In `src/features/b2b-invited-registration/submit.ts`, change the `callAcceptInvite({...})` to drop `departement`/`ville`:

```ts
  await callAcceptInvite({
    method: "password", code: values.code,
    nom: values.nom, prenom: values.prenom, telephone: values.telephone,
    password: values.password,
  });
```

In `src/app/(auth)/register-invited.tsx`, in the Google-path `callAcceptInvite({...})`, remove `departement`/`ville`.

- [ ] **Step 7: Update the form schema tests**

In `src/features/b2b-registration/__tests__/schema.test.ts`: in the `valid` fixture, replace `departement`/`ville` with `companyDepartement: "33 - Gironde"` and `companyVille: "Bordeaux"`. Keep the existing "companyDepartement is required" test. Add:

```ts
test("companyVille is required", () => {
  const result = b2bCompanyRegistrationSchema.safeParse({ ...valid, companyVille: "" });
  expect(result.success).toBe(false);
});
```

In `src/features/b2b-invited-registration/__tests__/schema.test.ts`: remove `departement`/`ville` from the fixture; if a test asserted their required-ness, delete it.

- [ ] **Step 8: Sync the form specs**

In `docs/specs/form-b2b-company-registration.md`: step 1 now lists Département **and Ville**; step 3 ("Vos coordonnées") lists only Nom / Prénom / Téléphone (remove the Département/Ville fields and the step-1→step-3 prefill note).
In `docs/specs/form-b2b-invited-registration.md`: the coordonnées step lists only Nom / Prénom / Téléphone.

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit && npx expo lint && npx jest src/features/b2b-registration src/features/b2b-invited-registration`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/data/registration.ts src/features/b2b-registration src/features/b2b-invited-registration src/features/registration/fields.tsx "src/app/(auth)/register.tsx" "src/app/(auth)/register-invited.tsx" docs/specs/form-b2b-company-registration.md docs/specs/form-b2b-invited-registration.md
git commit -m "feat(registration): capture company ville in step 1; drop user location from both flows"
```

---

### Task 4: Dossier region derived from the company

**Files:**
- Modify: `src/features/b2b-submission/toDossier.ts`
- Modify: `src/features/b2b-submission/submit.ts`
- Test: `src/features/b2b-submission/__tests__/toDossier.test.ts`

**Interfaces:**
- Consumes: `company.departement` from the caller.
- Produces: `toDossierPayload(values, session, company, photos)` where `company` is `{ id: string; name: string; departement: string }`; `region = regionForDepartement(company.departement)`.

- [ ] **Step 1: Update the failing test first**

In `src/features/b2b-submission/__tests__/toDossier.test.ts`, change the `toDossierPayload` calls to pass `company` with a `departement`, and assert the region comes from that (not the session). For the existing region cases, move the département onto the `company` argument. Example shape:

```ts
const company = { id: "comp_1", name: "Garage X", departement: "75 - Paris" };
const payload = toDossierPayload(values, session, company, { urls: [], thumbnailUrl: null });
expect(payload.region).toBe("NORTH");
```

Ensure any "SOUTH" / fallback case sets `company.departement` (e.g. `"13 - …"` → SOUTH, unknown → NORTH). **Leave the `session` fixture object unchanged** — `AppUser` still requires `departement`/`ville` until Task 6, so trimming the fixture now would fail `tsc`. Task 6 cleans this fixture once the fields are gone.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/features/b2b-submission/__tests__/toDossier.test.ts`
Expected: FAIL — `company` has no `departement` in the type / region still reads the session.

- [ ] **Step 3: Implement**

In `src/features/b2b-submission/toDossier.ts`, change the `company` parameter type and the `region` source:

```ts
export function toDossierPayload(
  values: B2bSubmissionForm,
  session: SessionUser,
  company: { id: string; name: string; departement: string },
  photos: { urls: string[]; thumbnailUrl: string | null },
): DossierWrite {
  return {
    status: "a_traiter",
    region: regionForDepartement(company.departement),
    companyId: company.id,
    submittedBy: session.id,
    // ... rest unchanged ...
```

- [ ] **Step 4: Pass the company département from the submission flow**

In `src/features/b2b-submission/submit.ts`, read the département from the company snapshot and pass it:

```ts
    const companySnap = await getDocFromServer(companyDoc(companyId));
    const companyName = companySnap.data()?.name ?? "";
    const companyDepartement = companySnap.data()?.departement ?? "";
```

and in the `toDossierPayload(...)` call, change the company argument to:

```ts
              { id: companyId, name: companyName, departement: companyDepartement },
```

- [ ] **Step 5: Verify**

Run: `npx jest src/features/b2b-submission && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/b2b-submission
git commit -m "feat(dossier): derive region from company.departement, not the user"
```

---

### Task 5: Account screen (two sections) + info-list components

**Files:**
- Modify: `src/components/native/AccountInfoList.tsx`
- Modify: `src/components/native/CompanyInfoList.tsx`
- Modify: `src/components/screens/AccountScreen.tsx`
- Modify (spec): `docs/specs/page-my-account.md`, `docs/specs/page-company.md`

**Interfaces:**
- Consumes: `useAccount`, `useCompany`.
- Produces: `AccountInfoList` shows personal fields only; `CompanyInfoList({ company, showName?, showRegion? })` (both default `true`) and gains a Ville row; b2b account shows two sections.

- [ ] **Step 1: Trim `AccountInfoList` to personal fields**

Replace the `rows` (and drop the back-office `region` branch) in `src/components/native/AccountInfoList.tsx`:

```tsx
export default function AccountInfoList({ user }: { user: AppUser }) {
  const rows: [string, string][] = [
    ["Nom", user.nom],
    ["Prénom", user.prenom],
    ["Email", user.email],
    ["Téléphone", user.telephone],
  ];
  return (
    <Host matchContents>
      <Column spacing={12}>
        {rows.map(([label, value]) => (
          <Row key={label} spacing={16}>
            <Text textStyle={LABEL}>{label}</Text>
            <Spacer flexible />
            <Text textStyle={VALUE}>{value}</Text>
          </Row>
        ))}
      </Column>
    </Host>
  );
}
```

- [ ] **Step 2: `CompanyInfoList` gains Ville + context props**

Replace the component in `src/components/native/CompanyInfoList.tsx`:

```tsx
import { Column, Host, Row, Spacer, Text } from "@expo/ui";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

const LABEL = { fontSize: 14, color: "#71727A" } as const;
const VALUE = { fontSize: 14, fontWeight: "500", color: "#111" } as const;

export default function CompanyInfoList({
  company,
  showName = true,
  showRegion = true,
}: {
  company: WithId<Company>;
  showName?: boolean;
  showRegion?: boolean;
}) {
  const rows: [string, string][] = [];
  if (showName) rows.push(["Entreprise", company.name]);
  rows.push(["SIRET", company.siret]);
  rows.push(["Département", company.departement]);
  rows.push(["Ville", company.ville]);
  if (showRegion) rows.push(["Région", company.region === "NORTH" ? "Nord" : "Sud"]);

  return (
    <Host matchContents>
      <Column spacing={12}>
        {rows.map(([label, value]) => (
          <Row key={label} spacing={16}>
            <Text textStyle={LABEL}>{label}</Text>
            <Spacer flexible />
            <Text textStyle={VALUE}>{value}</Text>
          </Row>
        ))}
      </Column>
    </Host>
  );
}
```

(The back-office company-detail screen calls `<CompanyInfoList company={...} />` with defaults, so it now also shows Ville — no change needed there.)

- [ ] **Step 3: Two-section account screen**

Replace `src/components/screens/AccountScreen.tsx`:

```tsx
import { ScrollView, StyleSheet, Text } from "react-native";
import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import { useAccount } from "@/lib/data/useAccount";
import { useCompany } from "@/lib/data/useCompanies";
import { tokens } from "@/theme/tokens";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  const company = useCompany(data?.companyId ?? "");
  if (loading || !data) return null; // guard shows briefly; layout splash covers first paint
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Mon compte</Text>
      <AccountInfoList user={data} />
      {data.companyId && company.data ? (
        <>
          <Text style={styles.sectionTitle}>{`Informations ${company.data.name}`}</Text>
          <CompanyInfoList company={company.data} showName={false} showRegion={false} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.lg },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
});
```

(`useCompany` has an empty-id guard, so `useCompany("")` for a back-office user with no `companyId` never subscribes.)

- [ ] **Step 4: Sync the specs**

In `docs/specs/page-my-account.md`: describe the two sections — "Mon compte" (Nom / Prénom / Email / Téléphone) and "Informations [nom entreprise]" (SIRET / Département / Ville), the latter shown only for b2b (users with a company).
In `docs/specs/page-company.md`: note that "Information vendeur admin" shows the owner's personal details only; the company's Département/Ville live in "Information vendeur".

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/native/AccountInfoList.tsx src/components/native/CompanyInfoList.tsx src/components/screens/AccountScreen.tsx docs/specs/page-my-account.md docs/specs/page-company.md
git commit -m "feat(account): two-section account screen; info lists follow the company-owns-location model"
```

---

### Task 6: Remove location from `AppUser` + the region claim (sweep)

**Files:**
- Modify: `src/lib/firestore/schema.ts`
- Modify: `src/lib/auth/session.ts`
- Modify: `firestore.rules`
- Test: `src/lib/auth/session.test.ts`
- Test: `src/lib/chat/senderName.test.ts`
- Test: `src/lib/firestore/__tests__/rules.test.ts`
- Test: `src/features/b2b-submission/__tests__/toDossier.test.ts`

**Interfaces:**
- Produces: `AppUser` without `region`/`departement`/`ville`; `AuthClaims`/`SessionUser` without `region`.

- [ ] **Step 1: Remove the fields from `AppUser`**

In `src/lib/firestore/schema.ts`, edit the `AppUser` interface to remove `region`, `departement`, and `ville`, and update the doc comment:

```ts
/** Mirrors the Auth custom claims; `role`/`companyId`/`status` are server-set. */
export interface AppUser {
  role: UserRole;
  companyId: string | null; // b2b only
  nom: string;
  prenom: string;
  email: string; // PII — owner + team read only
  telephone: string; // PII
  status: UserStatus; // pending until the company is validated
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

- [ ] **Step 2: Drop `region` from claims/session**

In `src/lib/auth/session.ts`:
- Remove `region: Region | null;` from `AuthClaims`.
- In `parseClaims`, remove the `region` line.
- In `buildSessionUser`, remove the `region: claims.region,` line.
- Remove the now-unused `Region` import if nothing else in the file uses it.

- [ ] **Step 3: Update the failing tests**

- `src/lib/auth/session.test.ts`: remove `region`/`departement`/`ville` from the `AppUser` profile fixture, and remove `region` from the `AuthClaims` fixture(s).
- `src/lib/chat/senderName.test.ts`: remove `departement`/`ville` (and `region` if present) from its `AppUser`/session fixture.
- `src/lib/firestore/__tests__/rules.test.ts:97`: the assertion that a b2b user may update their own `ville` must target a field that still exists — change it to update `telephone`:
  ```ts
  await assertSucceeds(updateDoc(doc(db, "users/user_b2b_nord"), { telephone: "0699999999" }));
  ```
- `src/features/b2b-submission/__tests__/toDossier.test.ts`: remove `departement`/`ville` (and `region` if present) from the `session` fixture object (they are no longer on `SessionUser`).

- [ ] **Step 4: Tidy the security rule**

In `firestore.rules`, in the `users/{uid}` update rule, drop `'region'` from the forbidden-keys list (the field no longer exists):

```
      allow update: if request.auth.uid == uid
        && !request.resource.data.diff(resource.data).affectedKeys()
             .hasAny(['role', 'companyId', 'status', 'createdAt']);
```

- [ ] **Step 5: Sweep for any remaining reference**

Run: `grep -rn -E "\.(region|departement|ville)\b|region:|departement:|ville:" src --include="*.ts" --include="*.tsx" | grep -viE "company\.|Company|resolveRegion|regionForDepartement|useRegionFilter|region-store|regionOptions|filterCompaniesByRegion|Dossier|dossier|useDossier|initialRegion|management|CompanyInfoList|payload"`
Expected: no hits pointing at a `user`/`session`/`AppUser` location field. Fix any that remain.

- [ ] **Step 6: Verify (full suites)**

Run: `npx tsc --noEmit && npx expo lint && npx jest && (cd functions && npx jest)`
Expected: PASS across the board.

- [ ] **Step 7: Commit**

```bash
git add src/lib/firestore/schema.ts src/lib/auth/session.ts firestore.rules src/lib/auth/session.test.ts src/lib/chat/senderName.test.ts src/lib/firestore/__tests__/rules.test.ts src/features/b2b-submission/__tests__/toDossier.test.ts
git commit -m "refactor: remove region/departement/ville from AppUser + region claim"
```

---

### Task 7: Update the seed

**Files:**
- Modify: `scripts/seed.ts`

**Interfaces:**
- Produces: emulator companies carry `ville`; user docs carry no location; no back-office `region` claim.

- [ ] **Step 1: Add `ville` to companies, drop user location**

In `scripts/seed.ts`:
- Add a `ville` to every `companies/...` `.set({...})` (e.g. `comp_nord` → `ville: "Paris"`, `comp_sud` → `ville: "Marseille"`, `comp_pending` → `ville: "Bordeaux"`), consistent with each company's `departement`.
- Remove `region`, `departement`, and `ville` from every `users/...` `.set({...})` profile.
- In the back-office `upsertUser("user_bo", ...)` **claims** object, remove `region` (keep `role: "backoffice"`, `companyId: null`, `status`), and remove `region` from that user's Firestore doc.

- [ ] **Step 2: Run the seed against the emulator**

Ensure the Firestore + Auth emulators are running, then:

Run: `npm run seed`
Expected: completes without error; `comp_pending` carries `ville`, and no user doc has `departement`/`ville`/`region`.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed.ts
git commit -m "chore(seed): company ville; drop user location + backoffice region claim"
```

---

## Verification summary

- Functions unit tests: `cd functions && npx jest` (company writes `ville`; user doc trimmed; `companyDepartement`/`companyVille` required).
- Client unit tests: `npx jest` (form schemas, `toDossier` region from company, session/rules sweeps).
- Typecheck/lint: `npx tsc --noEmit && npx expo lint`; functions `npm run build && npm run lint`.
- Manual walkthrough (emulators + re-seed): register a company (step 1 Département + Ville; coordonnées has no location) → back-office approves → open a dossier and confirm its region matches the company; b2b "Mon compte" shows the two sections; invited registration asks no location.
