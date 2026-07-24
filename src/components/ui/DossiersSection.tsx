import type { ReactNode } from "react";
import Section from "@/components/ui/Section";
import type { Dossier } from "@/lib/firestore/schema";
import type { WithId } from "@/lib/firestore/collections";

interface Props {
  title: string;
  dossiers: WithId<Dossier>[];
  loading: boolean;
  emptyMessage: string;
  renderCard: (d: WithId<Dossier>) => ReactNode;
}

export default function DossiersSection({
  title,
  dossiers,
  loading,
  emptyMessage,
  renderCard,
}: Props) {
  return (
    <Section title={title} loading={loading} emptyMessage={emptyMessage}>
      {dossiers.map(renderCard)}
    </Section>
  );
}
