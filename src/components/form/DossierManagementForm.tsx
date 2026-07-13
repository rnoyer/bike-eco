import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { z } from "zod";

import ControlledDropdown from "@/components/form/ControlledDropdown";
import ControlledField from "@/components/form/ControlledField";
import Button from "@/components/ui/Button";
import type { DossierStatus, Region } from "@/lib/firestore/schema";
import { tokens } from "@/theme/tokens";

const STATUS_OPTIONS: { label: string; value: DossierStatus }[] = [
  { label: "À traiter", value: "a_traiter" },
  { label: "En cours", value: "en_cours" },
  { label: "Clôturé", value: "cloture" },
];
const STATUS_LABELS = STATUS_OPTIONS.map((o) => o.label);
const statusLabelOf = (value: DossierStatus) =>
  STATUS_OPTIONS.find((o) => o.value === value)!.label;
const statusValueOf = (label: string) =>
  STATUS_OPTIONS.find((o) => o.label === label)!.value;

const REGION_OPTIONS: { label: string; value: Region }[] = [
  { label: "Nord", value: "NORTH" },
  { label: "Sud", value: "SOUTH" },
];
const REGION_LABELS = REGION_OPTIONS.map((o) => o.label);
const regionLabelOf = (value: Region) =>
  REGION_OPTIONS.find((o) => o.value === value)!.label;
const regionValueOf = (label: string) =>
  REGION_OPTIONS.find((o) => o.label === label)!.value;

const schema = z.object({
  region: z.string().min(1),
  status: z.string().min(1),
  price: z.string(),
});
type FormValues = z.infer<typeof schema>;

const digitsOnly = (text: string) => text.replace(/\D/g, "");

interface Props {
  initialRegion: Region;
  initialStatus: DossierStatus;
  initialPrice: number | null;
  onSubmit: (region: Region, status: DossierStatus, price: number | null) => void;
}

export default function DossierManagementForm({
  initialRegion,
  initialStatus,
  initialPrice,
  onSubmit,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    defaultValues: {
      region: regionLabelOf(initialRegion),
      status: statusLabelOf(initialStatus),
      price: initialPrice != null ? String(initialPrice) : "",
    },
  });

  return (
    <FormProvider {...form}>
      <View style={styles.fields}>
        <ControlledDropdown
          name="region"
          label="Région attribuée"
          options={REGION_LABELS}
        />
        <ControlledDropdown
          name="status"
          label="Statut du dossier"
          options={STATUS_LABELS}
        />
        <ControlledField
          name="price"
          label="Prix d'achat négocié"
          placeholder="€"
          keyboardType="numeric"
          suffix="€"
          transform={digitsOnly}
        />
        <Button
          label="Mettre à jour"
          onPress={form.handleSubmit((v) =>
            onSubmit(
              regionValueOf(v.region),
              statusValueOf(v.status),
              v.price ? Number(v.price) : null
            )
          )}
        />
      </View>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.space.lg },
});
