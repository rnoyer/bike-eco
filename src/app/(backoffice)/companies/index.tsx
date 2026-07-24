import { useRouter } from "expo-router";
import { ScrollView } from "react-native";

import CompaniesSection from "@/components/ui/CompaniesSection";
import CompanyCard from "@/components/ui/CompanyCard";
import SectionWrapper from "@/components/ui/SectionWrapper";
import { useCompanies } from "@/lib/data/useCompanies";
import { useRegionFilter } from "@/lib/data/useRegionFilter";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

export default function CompaniesListScreen() {
  const router = useRouter();
  const { region } = useRegionFilter();
  const pending = useCompanies("pending", region);
  const active = useCompanies("active", region);

  const card = (c: WithId<Company>) => (
    <CompanyCard
      key={c.id}
      title={c.name}
      subtitle={c.createdByName}
      onManage={() => router.push(`/(backoffice)/companies/${c.id}`)}
    />
  );

  return (
    <ScrollView>
      <SectionWrapper>
        <CompaniesSection
          title="Vendeurs à valider"
          companies={pending.data}
          loading={pending.loading}
          emptyMessage="Pas de vendeur a valider pour le moment."
          renderCard={card}
        />
        <CompaniesSection
          title="Vendeurs enregistrées"
          companies={active.data}
          loading={active.loading}
          emptyMessage="Pas de vendeur enregistrée pour le moment."
          renderCard={card}
        />
      </SectionWrapper>
    </ScrollView>
  );
}
