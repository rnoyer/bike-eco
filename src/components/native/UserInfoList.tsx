import type { Dossier } from "@/lib/firestore/schema";
import { Column, Host, Row, Spacer, Text } from "@expo/ui";

const LABEL = { fontSize: 14, color: "#71727A" } as const;
const VALUE = { fontSize: 14, fontWeight: "500", color: "#111" } as const;

export default function UserInfoList({ dossier }: { dossier: Dossier }) {
  const rows: [string, string][] = [
    ["Entreprise", dossier.submitter.companyName],
    ["Nom", dossier.submitter.nom],
    ["Prénom", dossier.submitter.prenom],
    // TODO : ["Date de soumission", dossier.createdAt] > convert timestamp to readable date : JJ MMM AAAA hh:mm
    // TODO : Add phone and email
  ];
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
