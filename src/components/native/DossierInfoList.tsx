import { Host, List, ListItem } from "@expo/ui";
import type { Dossier } from "@/lib/firestore/schema";

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
  return (
    <Host matchContents>
      <List>
        {rows.map(([label, value]) => (
          <ListItem key={label} supportingText={value}>
            {label}
          </ListItem>
        ))}
      </List>
    </Host>
  );
}
