import { StyleSheet, View } from "react-native";

import Dropdown from "@/components/form/Dropdown";
import Button from "@/components/ui/Button";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import {
  REGION_OPTIONS,
  fromRegion,
  toRegion,
} from "@/lib/navigation/regionOptions";
import type { UserRole } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

const REGION_LABELS = REGION_OPTIONS.map((o) => o.label);

interface Props {
  role: UserRole;
  onInvite: () => void;
  onDelete: () => void;
}

export default function SettingsList({ role, onInvite, onDelete }: Props) {
  const { region, setRegion } = useRegionFilter();
  const currentLabel =
    REGION_OPTIONS.find((o) => o.value === fromRegion(region))?.label ?? null;

  return (
    <View style={styles.container}>
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
      <Button
        variant="outlined"
        label="Inviter un collègue"
        onPress={onInvite}
      />
      <Button variant="text" label="Supprimer son compte" onPress={onDelete} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.space.md },
});
