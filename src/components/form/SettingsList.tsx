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
          label="Inviter un collègue de mon entreprise  "
          onPress={onInvite}
        />
      </Section>
    </SectionWrapper>
  );
}
