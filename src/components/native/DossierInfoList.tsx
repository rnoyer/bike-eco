import { Column, Host, Row, Spacer, Text } from "@expo/ui";
import type { Dossier } from "@/lib/firestore/schema";

const LABEL = { fontSize: 14, color: "#71727A" } as const;
const VALUE = { fontSize: 14, fontWeight: "500", color: "#111" } as const;

const dash = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

export default function DossierInfoList({ dossier }: { dossier: Dossier }) {
  const { vehicle, condition, papers, pricing } = dossier;
  const rows: [string, string][] = [
    ["Marque", dash(vehicle.marque)],
    ["Modèle", dash(vehicle.modele)],
    ["Cylindrée", vehicle.cylindree ? `${vehicle.cylindree} cc` : "—"],
    ["Année", dash(vehicle.annee)],
    ["Kilométrage", vehicle.kilometrage ? `${vehicle.kilometrage} km` : "—"],
    ["Électrique", dash(vehicle.electrique)],
    ["Accessoires", dash(vehicle.accessoires)],
    ["État", dash(condition.etat)],
    ["Carte grise", dash(papers.carteGrise)],
    ["Contrôle technique", dash(papers.controleTechnique)],
    ["Prix souhaité", pricing.prix ? `${pricing.prix} €` : "—"],
    ["Commentaires", dash(pricing.commentaires)],
  ];
  // A non-scrolling Column (not List): the screen's RN ScrollView owns
  // scrolling, and a native scroller here would crash on Android when measured
  // with unbounded height.
  return (
    <Host matchContents>
      <Column spacing={12}>
        {rows.map(([label, value]) => (
          <Row key={label} spacing={16}>
            <Text textStyle={LABEL}>{label}</Text>
            <Spacer flexible />
            <Text textStyle={VALUE}>{value}</Text>
          </Row>
        ))}
      </Column>
    </Host>
  );
}
