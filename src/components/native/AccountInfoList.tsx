import { Host, List, ListItem } from "@expo/ui";
import type { AppUser } from "@/lib/firestore/schema";

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
