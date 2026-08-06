import { Column, Host, Row, Spacer, Text } from "@expo/ui";
import type { AppUser } from "@/lib/firestore/schema";

const LABEL = { fontSize: 14, color: "#71727A" } as const;
const VALUE = { fontSize: 14, fontWeight: "500", color: "#111" } as const;

export default function AccountInfoList({
  user,
  roleLabel,
}: {
  user: AppUser;
  /** Adds a "Rôle" row — used by the colleague screens, omitted on "Mon compte". */
  roleLabel?: string;
}) {
  const rows: [string, string][] = [
    ["Nom", user.nom],
    ["Prénom", user.prenom],
    ["Email", user.email],
    ["Téléphone", user.telephone],
    ...(roleLabel ? ([["Rôle", roleLabel]] as [string, string][]) : []),
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
