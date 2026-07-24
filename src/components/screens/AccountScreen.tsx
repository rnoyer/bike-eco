import { ScrollView, StyleSheet, Text } from "react-native";
import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import { useAccount } from "@/lib/data/useAccount";
import { useCompany } from "@/lib/data/useCompanies";
import { tokens } from "@/theme/tokens";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  const company = useCompany(data?.companyId ?? "");
  if (loading || !data) return null; // guard shows briefly; layout splash covers first paint
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Mon compte</Text>
      <AccountInfoList user={data} />
      {data.companyId && company.data ? (
        <>
          <Text style={styles.sectionTitle}>{`Informations ${company.data.name}`}</Text>
          <CompanyInfoList company={company.data} showName={false} showRegion={false} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: tokens.space.lg, gap: tokens.space.lg },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: tokens.colors.primary },
});
