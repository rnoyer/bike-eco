import { Button, Column, Host, Picker, Text } from "@expo/ui";
import type { UserRole } from "@/lib/firestore/schema";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import {
  REGION_OPTIONS,
  fromRegion,
  toRegion,
} from "@/lib/navigation/regionOptions";

const LABEL = { fontSize: 14, fontWeight: "600", color: "#111" } as const;

interface Props {
  role: UserRole;
  onInvite: () => void;
  onDelete: () => void;
}

export default function SettingsList({ role, onInvite, onDelete }: Props) {
  const { region, setRegion } = useRegionFilter();
  // A non-scrolling Column (not FieldGroup): the screen's RN ScrollView owns
  // scrolling; a native scroller here would crash on Android (infinite height).
  return (
    <Host matchContents>
      <Column spacing={16}>
        {role === "backoffice" ? (
          <>
            <Text textStyle={LABEL}>Région gérée</Text>
            <Picker
              selectedValue={fromRegion(region)}
              onValueChange={(v) => setRegion(toRegion(v))}
            >
              {REGION_OPTIONS.map((o) => (
                <Picker.Item key={o.value} label={o.label} value={o.value} />
              ))}
            </Picker>
          </>
        ) : null}
        <Button variant="outlined" label="Inviter un collègue" onPress={onInvite} />
        <Button variant="text" label="Supprimer son compte" onPress={onDelete} />
      </Column>
    </Host>
  );
}
