import AccountInfoList from "@/components/native/AccountInfoList";
import CompanyInfoList from "@/components/native/CompanyInfoList";
import Button from "@/components/ui/Button";
import Section from "@/components/ui/Section";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useAccount } from "@/lib/data/useAccount";
import { useCompany } from "@/lib/data/useCompanies";
import { useSession } from "@/lib/data/useSession";
import { Alert, ScrollView } from "react-native";

export default function AccountScreen() {
  const { data, loading } = useAccount();
  const company = useCompany(data?.companyId ?? "");
  const { signOut } = useSession();
  if (loading || !data) return null; // guard shows briefly; layout splash covers first paint
  return (
    <ScrollView>
      <SectionWrapper>
        <Section title="Mes informations personnelles">
          <AccountInfoList user={data} />
        </Section>
        {data.companyId && company.data ? (
          <Section title={`Informations ${company.data.name}`}>
            <CompanyInfoList
              company={company.data}
              showName={false}
              showRegion={false}
            />
          </Section>
        ) : null}
        <Section title="Actions sur mon compte">
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
        </Section>
      </SectionWrapper>
    </ScrollView>
  );
}
