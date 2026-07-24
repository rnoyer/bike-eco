import Dropdown from "@/components/form/Dropdown";
import Button from "@/components/ui/Button";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import type { UserRole } from "@/lib/firestore/schema";
import {
  REGION_OPTIONS,
  fromRegion,
  toRegion,
} from "@/lib/navigation/regionOptions";
import { tokens } from "@/theme/tokens";
import { StyleSheet, Text, View } from "react-native";

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
    <View style={styles.container}>
      {role === "backoffice" ? (
        <>
          <Dropdown
            label="Région gérée"
            options={REGION_LABELS}
            value={currentLabel}
            onChange={(label) => {
              const option = REGION_OPTIONS.find((o) => o.label === label);
              if (option) setRegion(toRegion(option.value));
            }}
          />
        </>
      ) : null}
      {role === "backoffice" ? (
        <>
          <Text style={styles.sectionTitle}>Gestion des entreprises</Text>
          <Button
            variant="outlined"
            label="Ajouter/Supprimer une entreprises"
            onPress={() => onManageCompanies?.()}
          />
        </>
      ) : null}
      <Text style={styles.sectionTitle}>Gestion des membres</Text>
      <Button
        variant="outlined"
        label="Inviter un collègue"
        onPress={onInvite}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: tokens.space.md },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.colors.primary,
  },
});
