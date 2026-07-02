import { Column, Host, Row, Spacer, Text } from "@expo/ui";
import type { AppUser } from "@/lib/firestore/schema";

const LABEL = { fontSize: 14, color: "#71727A" } as const;
const VALUE = { fontSize: 14, fontWeight: "500", color: "#111" } as const;

export default function AccountInfoList({ user }: { user: AppUser }) {
  const rows: [string, string][] = [
    ["Nom", user.nom],
    ["Prénom", user.prenom],
    ["Email", user.email],
    ["Téléphone", user.telephone],
    ["Département", user.departement],
    ["Ville", user.ville],
  ];
  if (user.role === "backoffice" && user.region) {
    rows.push(["Région", user.region === "NORTH" ? "Nord" : "Sud"]);
  }
  // A non-scrolling Column (not List) so the Host can size to its content
  // inside the screen's RN ScrollView — a native scroller here would be
  // measured with infinite height and crash on Android.
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
