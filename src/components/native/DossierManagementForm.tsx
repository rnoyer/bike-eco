import { Button, FieldGroup, Host, Picker, TextInput, useNativeState } from "@expo/ui";
import { useState } from "react";
import type { DossierStatus } from "@/lib/firestore/schema";

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

  return (
    <Host matchContents>
      <FieldGroup>
        <FieldGroup.Section title="Statut du dossier">
          <Picker
            selectedValue={status}
            onValueChange={(v) => setStatus(v)}
          >
            {STATUS_OPTIONS.map((o) => (
              <Picker.Item key={o.value} label={o.label} value={o.value} />
            ))}
          </Picker>
        </FieldGroup.Section>
        <FieldGroup.Section title="Prix d'achat négocié">
          <TextInput value={price} placeholder="€" keyboardType="numeric" />
        </FieldGroup.Section>
        <Button
          label="Mettre à jour"
          onPress={() => {
            const digits = price.value.replace(/\D/g, "");
            onSubmit(status, digits ? Number(digits) : null);
          }}
        />
      </FieldGroup>
    </Host>
  );
}
