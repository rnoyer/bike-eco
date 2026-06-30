import { Button, FieldGroup, Host, Picker } from "@expo/ui";
import type { UserRole } from "@/lib/firestore/schema";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import {
  REGION_OPTIONS,
  fromRegion,
  toRegion,
} from "@/lib/navigation/regionOptions";

interface Props {
  role: UserRole;
  onInvite: () => void;
  onDelete: () => void;
}

export default function SettingsList({ role, onInvite, onDelete }: Props) {
  const { region, setRegion } = useRegionFilter();
  return (
    <Host matchContents>
      <FieldGroup>
        {role === "backoffice" ? (
          <FieldGroup.Section title="Région géré">
            <Picker
              selectedValue={fromRegion(region)}
              onValueChange={(v) => setRegion(toRegion(v))}
            >
              {REGION_OPTIONS.map((o) => (
                <Picker.Item key={o.value} label={o.label} value={o.value} />
              ))}
            </Picker>
          </FieldGroup.Section>
        ) : null}
        <FieldGroup.Section>
          <Button variant="outlined" label="Inviter un collègue" onPress={onInvite} />
          <Button variant="text" label="Supprimer son compte" onPress={onDelete} />
        </FieldGroup.Section>
      </FieldGroup>
    </Host>
  );
}
