import type { ReactNode } from "react";
import Section from "@/components/ui/Section";
import type { WithId } from "@/lib/firestore/collections";
import type { Company } from "@/lib/firestore/schema";

interface Props {
  title: string;
  companies: WithId<Company>[];
  loading: boolean;
  /** The read hook's mapped French error, so a denied or offline query does
   *  not render as "pas d'entreprise". */
  error?: string | null;
  emptyMessage: string;
  renderCard: (c: WithId<Company>) => ReactNode;
}

export default function CompaniesSection({
  title,
  companies,
  loading,
  error,
  emptyMessage,
  renderCard,
}: Props) {
  return (
    <Section
      title={title}
      loading={loading}
      error={error}
      emptyMessage={emptyMessage}
    >
      {companies.map(renderCard)}
    </Section>
  );
}
