import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import Button from "@/components/ui/Button";
import { useAccount } from "@/lib/data/useAccount";
import { useCompany } from "@/lib/data/useCompanies";
import { useSession } from "@/lib/data/useSession";
import { tokens } from "@/theme/tokens";
import { Alert, ScrollView, StyleSheet, Text } from "react-native";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  const company = useCompany(data?.companyId ?? "");
  const { signOut } = useSession();
  if (loading || !data) return null; // guard shows briefly; layout splash covers first paint
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Mes informations personnelles</Text>
      <AccountInfoList user={data} />
      {data.companyId && company.data ? (
        <>
          <Text
            style={styles.sectionTitle}
          >{`Informations ${company.data.name}`}</Text>
          <CompanyInfoList
            company={company.data}
            showName={false}
            showRegion={false}
          />
        </>
      ) : null}
      <Text style={styles.sectionTitle}>Actions sur mon compte</Text>
      <Button variant="primary" label="Se déconnecter" onPress={signOut} />
      <Button
        variant="outlined"
        label="Supprimer mon compte"
        onPress={() =>
          Alert.alert(
            "Supprimer mon compte",
            "Action non disponible pour le moment.",
          )
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.lg },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: tokens.colors.primary,
  },
});
