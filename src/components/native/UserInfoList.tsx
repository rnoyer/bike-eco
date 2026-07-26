import type { Dossier } from "@/lib/firestore/schema";
import { Column, Host, Row, Spacer, Text } from "@expo/ui";

const LABEL = { fontSize: 14, color: "#71727A" } as const;
const VALUE = { fontSize: 14, fontWeight: "500", color: "#111" } as const;

const dash = (v: unknown) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

/** "26 juil. 2026 14:30" — JJ MMM AAAA hh:mm. */
function submittedAt(createdAt: Dossier["createdAt"]): string {
  if (!createdAt) return "—";
  const d = createdAt.toDate();
  const date = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

export default function UserInfoList({ dossier }: { dossier: Dossier }) {
  const { submitter } = dossier;
  const rows: [string, string][] = [
    ["Entreprise", dash(submitter.companyName)],
    ["Nom", dash(submitter.nom)],
    ["Prénom", dash(submitter.prenom)],
    ["Email", dash(submitter.email)],
    ["Téléphone", dash(submitter.telephone)],
    ["Date de soumission", submittedAt(dossier.createdAt)],
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
