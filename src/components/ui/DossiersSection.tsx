import type { ReactNode } from "react";
import Section from "@/components/ui/Section";
import type { Dossier } from "@/lib/firestore/schema";
import type { WithId } from "@/lib/firestore/collections";

interface Props {
  title: string;
  dossiers: WithId<Dossier>[];
  loading: boolean;
  /** The read hook's mapped French error, so a denied or offline query does
   *  not render as "vous n'avez pas de dossier". */
  error?: string | null;
  emptyMessage: string;
  renderCard: (d: WithId<Dossier>) => ReactNode;
}

export default function DossiersSection({
  title,
  dossiers,
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
      {dossiers.map(renderCard)}
    </Section>
  );
}
