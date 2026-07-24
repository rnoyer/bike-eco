import { Column, Host, Row, Spacer, Text } from "@expo/ui";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

const LABEL = { fontSize: 14, color: "#71727A" } as const;
const VALUE = { fontSize: 14, fontWeight: "500", color: "#111" } as const;

export default function CompanyInfoList({ company }: { company: WithId<Company> }) {
  const rows: [string, string][] = [
    ["Entreprise", company.name],
    ["SIRET", company.siret],
    ["Département", company.departement],
    ["Région", company.region === "NORTH" ? "Nord" : "Sud"],
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
