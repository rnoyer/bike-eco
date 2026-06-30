import { Button, Column, Host, Picker, Text, TextInput, useNativeState } from "@expo/ui";
import { useState } from "react";
import type { DossierStatus } from "@/lib/firestore/schema";

const LABEL = { fontSize: 14, fontWeight: "600", color: "#111" } as const;

const STATUS_OPTIONS: { label: string; value: DossierStatus }[] = [
  { label: "À traiter", value: "a_traiter" },
  { label: "En cours", value: "en_cours" },
  { label: "Clôturé", value: "cloture" },
];

interface Props {
  initialStatus: DossierStatus;
  initialPrice: number | null;
  onSubmit: (status: DossierStatus, price: number | null) => void;
}

export default function DossierManagementForm({
  initialStatus,
  initialPrice,
  onSubmit,
}: Props) {
  const [status, setStatus] = useState<DossierStatus>(initialStatus);
  const price = useNativeState(initialPrice != null ? String(initialPrice) : "");

  // A non-scrolling Column (not FieldGroup): the screen's RN ScrollView owns
  // scrolling; a native scroller here would crash on Android (infinite height).
  return (
    <Host matchContents>
      <Column spacing={12}>
        <Text textStyle={LABEL}>Statut du dossier</Text>
        <Picker selectedValue={status} onValueChange={(v) => setStatus(v)}>
          {STATUS_OPTIONS.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
        <Text textStyle={LABEL}>Prix d&apos;achat négocié</Text>
        <TextInput value={price} placeholder="€" keyboardType="numeric" />
        <Button
          label="Mettre à jour"
          onPress={() => {
            const digits = price.value.replace(/\D/g, "");
            onSubmit(status, digits ? Number(digits) : null);
          }}
        />
      </Column>
    </Host>
  );
}
