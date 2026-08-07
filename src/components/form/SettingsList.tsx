import Dropdown from "@/components/form/Dropdown";
import Button from "@/components/ui/Button";
import ColleaguesSection from "@/components/ui/ColleaguesSection";
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
  /** Gates both admin-only affordances: inviting, and the per-colleague
   *  "Gérer" button. */
  isAdmin: boolean;
  onInvite: () => void;
  onManageCompanies?: () => void;
  onManageColleague: (uid: string) => void;
}

export default function SettingsList({
  role,
  isAdmin,
  onInvite,
  onManageCompanies,
  onManageColleague,
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
        <Section title="Gérer les entreprises et les vendeurs">
          <Button
            variant="outlined"
            label="Gérer"
            onPress={() => onManageCompanies?.()}
          />
        </Section>
      ) : null}
      {isAdmin ? (
        <Section
          title={
            role === "backoffice"
              ? "Inviter un membre de l'équipe Bike-eco"
              : "Inviter un collaborateur de mon entreprise"
          }
        >
          <Button variant="outlined" label="Inviter" onPress={onInvite} />
        </Section>
      ) : null}
      <ColleaguesSection canManage={isAdmin} onManage={onManageColleague} />
    </SectionWrapper>
  );
}
