import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { StyleSheet, View } from "react-native";
import { z } from "zod";

import ControlledDropdown from "@/components/form/ControlledDropdown";
import ControlledField from "@/components/form/ControlledField";
import Button from "@/components/ui/Button";
import { digitsOnly } from "@/lib/forms/transforms";
import {
  DOSSIER_STATUSES,
  REGIONS,
  type DossierStatus,
  type Region,
} from "@/lib/firestore/schema";
import {
  labelledOptions,
  REGION_LABELS,
  STATUS_LABELS,
} from "@/lib/ui/format";
import { tokens } from "@/theme/tokens";

// Derived from the one label table each, so this screen's dropdowns cannot
// drift from the badge and the "Statut" info row that read the same tables.
const STATUS = labelledOptions(DOSSIER_STATUSES, STATUS_LABELS);
const REGION = labelledOptions(REGIONS, REGION_LABELS);

const schema = z.object({
  region: z.string().min(1),
  status: z.string().min(1),
  price: z.string(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  initialRegion: Region;
  initialStatus: DossierStatus;
  initialPrice: number | null;
  onSubmit: (
    region: Region,
    status: DossierStatus,
    price: number | null,
  ) => void;
  /** The update is in flight — the button spins and stops accepting taps. */
  busy?: boolean;
}

export default function DossierManagementForm({
  initialRegion,
  initialStatus,
  initialPrice,
  onSubmit,
  busy = false,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onBlur",
    // `values` (not `defaultValues`) so the form re-syncs when the live dossier
    // changes under an open Gestion tab — `defaultValues` is read only once at
    // mount. `keepDirtyValues` preserves any field the back-office has already
    // started editing, so a background update never clobbers work in progress.
    values: {
      region: REGION_LABELS[initialRegion],
      status: STATUS_LABELS[initialStatus],
      price: initialPrice != null ? String(initialPrice) : "",
    },
    resetOptions: { keepDirtyValues: true },
  });

  return (
    <FormProvider {...form}>
      <View style={styles.fields}>
        <ControlledDropdown
          name="region"
          label="Région attribuée"
          options={REGION.labels}
        />
        <ControlledDropdown
          name="status"
          label="Statut du dossier"
          options={STATUS.labels}
        />
        <ControlledField
          name="price"
          label="Prix d'achat validé"
          placeholder="€"
          keyboardType="numeric"
          suffix="€"
          transform={digitsOnly()}
        />
        <Button
          label="Mettre à jour"
          loading={busy}
          onPress={form.handleSubmit((v) =>
            onSubmit(
              REGION.valueOf(v.region),
              STATUS.valueOf(v.status),
              v.price ? Number(v.price) : null,
            ),
          )}
        />
      </View>
    </FormProvider>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.space.lg },
});
