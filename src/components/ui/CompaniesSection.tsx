import type { ReactNode } from "react";
import Section from "@/components/ui/Section";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

interface Props {
  title: string;
  companies: WithId<Company>[];
  loading: boolean;
  emptyMessage: string;
  renderCard: (c: WithId<Company>) => ReactNode;
}

export default function CompaniesSection({
  title,
  companies,
  loading,
  emptyMessage,
  renderCard,
}: Props) {
  return (
    <Section title={title} loading={loading} emptyMessage={emptyMessage}>
      {companies.map(renderCard)}
    </Section>
  );
}
